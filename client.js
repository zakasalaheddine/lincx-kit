const xtend = require('xtend')
const cuid = require('cuid')
const debug = require('debug')('adverse')
const once = require('lodash.once')
const mustache = require('mustache')

const api = require('./api')
const template = require('./template')
const parseParams = require('./parse-params')
const localISOString = require('./local-iso-string')
const { render, reRender } = require('./render')
const visibilityMonitor = require('./visibility-monitor')
const initLocalDebug = require('./local-debug')
const parse = require('./parse-query-string')

let localDebug
const VISIBILITY_THRESHOLD = 50
const VISIBILITY_TIME_MS = 1000
const prefixes = ['adverse-', 'lincx-', 'tgt-']

module.exports = displayAd
module.exports.prepareDataForRender = prepareDataForRender

function displayAd (target, opts) {
  // get script data-* attributes
  localDebug = initLocalDebug(window)
  const scriptNode = getScriptNode(window)
  const headNode = getHeadNode(window)
  const mountTarget = target || scriptNode.parentNode

  if (!opts.debug && localDebug.enabled) {
    return localDebug.loadDebugBundle(scriptNode)
  }

  const options = xtend({}, target ? opts : scriptNode.dataset)
  if (Object.prototype.hasOwnProperty.call(options, 'testMode')) {
    options.testMode !== 'false' && (options['test-mode'] = options.testMode)
    delete options.testMode
  }

  const { manualRender, ...restOpts } = options

  if (manualRender === 'true' && !window.adverse && !window.lincx) {
    window.adverse = window.lincx = function (target, options) {
      const defaultOpts = { apiUrl: opts.apiUrl }
      displayAd(target, { ...options, ...defaultOpts })
    }
    return
  }

  prepareDataForRender(
    { apiUrl: opts.apiUrl, dataset: restOpts },
    function (err, data) {
      if (err) return debug(err)
      const renderAds = options.reRenderAdFeed ? reRender : render
      data.newTemplateId = options.reRenderAdFeed && options.templateId
      data.lincxListen = options.lincxListen
      data.originalAttributes = scriptNode && scriptNode.attributes
      data.originalSrc = scriptNode && scriptNode.src
      data.originalTarget = mountTarget
      renderAds(data, mountTarget, headNode)
    }
  )
}

function prepareDataForRender ({ apiUrl, dataset, getGeo = api.getGeo }, cb) {
  let {
    zoneid,
    zoneId,
    geoState,
    timestamp,
    adFeedCount,
    zoneLoadCost,
    scoreKey,
    templateId,
    renderMode,
    forcedAdPositions,
    ...datasetExtraParams
  } = dataset

  const query = parse(window.location.search)
  const prefixedSearchParams = parseParams(prefixes, query)
  if (prefixedSearchParams['test-mode'] === 'false') {
    delete prefixedSearchParams['test-mode']
  }
  const extraParams = datasetExtraParams.reRenderAdFeed
    ? { ...prefixedSearchParams, ...dataset }
    : { ...datasetExtraParams, ...prefixedSearchParams }
  debug('Received opts', apiUrl, zoneid, extraParams)

  getGeo(apiUrl, function (err, geo) {
    if (err) return cb(err)

    window.lincxGeo || (window.lincxGeo = geo)

    if (/:|{|}/.test(extraParams.scoreKey)) {
      delete extraParams.scoreKey
    }
    if (extraParams.templateId) {
      templateId = extraParams.templateId
      delete extraParams.templateId
    }

    const href = window ? encodeURIComponent(window.location.href) : undefined
    const zoneLoadEventId = cuid()
    const options = {
      zoneId: extraParams.zoneId || zoneid || zoneId,
      renderMode,
      href,
      geoCity: geo.geoCity,
      geoRegion: geo.geoRegion,
      geoState: geoState || geo.geoRegion,
      geoIP: geo.geoIP,
      geoPostal: geo.geoPostal,
      geoCountry: geo.geoCountry,
      geoCountryName: geo.geoCountryName,
      adFeedCount,
      timestamp: timestamp || localISOString(new Date()),
      scoreKey:
        extraParams.scoreKey || (/:|{|}/.test(scoreKey) ? undefined : scoreKey),
      templateId,
      forcedAdPositions,
      zoneLoadEventId,
      ...extraParams
    }

    if (
      window.lincxData &&
      window.lincxData[options.zoneId] &&
      window.lincxData[options.zoneId].templateId &&
      datasetExtraParams.reRenderAdFeed &&
      !templateId
    ) {
      options.templateId = window.lincxData[options.zoneId].templateId
    }

    if (
      window.lincxData &&
      window.lincxData[options.zoneId] &&
      window.lincxData[options.zoneId].segmentId &&
      !options.segmentId
    ) {
      options.segmentId = window.lincxData[options.zoneId].segmentId
    }

    const eventData = {
      ...geo,
      geoState: geoState || geo.geoRegion,
      ...extraParams,
      zoneId: extraParams.zoneId || zoneid || zoneId,
      zoneLoadEventId,
      scoreKey: options.scoreKey,
      windowLocation: window.location.href,
      documentReferrer: (window.document && window.document.referrer) || ''
    }

    api.sendSiteLoadEvent(apiUrl, eventData)
    api.getAds(apiUrl, options, function (err, result) {
      if (err) return cb(err)
      if (result.error) return cb(result.error)
      const { ads, template, remoteFeedSetId, remoteFeedSetName } = result
      Object.assign(eventData, result.dataAttributesDefault)

      if (result.segmentName) {
        eventData.segmentName = result.segmentName
        eventData.segmentId = result.segmentId
      }
      options.qty = ads.length

      if (template) {
        eventData.templateId = template.id
      }
      eventData.remoteFeedSetId = remoteFeedSetId
      eventData.remoteFeedSetName = remoteFeedSetName

      const zoneLoadEventData = {
        ...eventData,
        adsIds: ads.map(ad => ad.adId).toString(),
        cost: zoneLoadCost,
        eventId: zoneLoadEventId
      }
      api.sendZoneLoadEvent(apiUrl, zoneLoadEventData)

      const data = { template, zoneId: options.zoneId }
      if (result.segmentId) {
        data.segmentId = result.segmentId
      }
      data.ads = ads.map(function (ad, rank) {
        ad._index = rank
        const dataAvailForCreativeFields = {
          ...geo,
          ...extraParams,
          ...options,
          segmentName: eventData.segmentName,
          totalAds: ads.length
        }
        if (template) {
          dataAvailForCreativeFields.templateId = template.id
        }
        const macros = getMacros(ad, dataAvailForCreativeFields)
        renderCreativeVariables(ad, macros)
        ad = sanitizeEmptyValues(ad)

        const adEventData = {
          ...eventData,
          rank,
          adId: ad.adId,
          creativeId: ad.id,
          adverseClickId: ad.adverseClickId
        }

        const sendLoadEvent = once((event, adNode) => {
          api.sendLoadEvent(apiUrl, {
            ...adEventData,
            rank: adNode.dataset.rank || adEventData.rank
          })
        })
        const sendImpressionEvent = once(adNode => {
          api.sendImpressionEvent(apiUrl, {
            ...adEventData,
            rank: adNode.dataset.rank || adEventData.rank
          })
        })
        const sendClickEvent = once((adNode, ctaData = {}) => {
          sendImpressionEvent(adNode)
          const payload = {
            ...ctaData,
            ...adEventData,
            rank: adNode.dataset.rank || adEventData.rank
          }
          api.trackClick(apiUrl, payload)
        })

        const listeners = {
          onload: sendLoadEvent,
          onclick: function (ev, element) {
            const ctaData = extractCtaAttributes(ev.target)
            sendClickEvent(element, ctaData)
          },
          mousedown: function (ev1, element) {
            if (ev1.which === 2) {
              const ctaData = extractCtaAttributes(ev1.target)
              ev1.target.addEventListener(
                'mouseup',
                ev2 => {
                  if (ev1.target === ev2.target) {
                    sendClickEvent(element, ctaData)
                  }
                },
                { once: true }
              )
            }
          },
          trackVisibility: function (elem) {
            let stepsTable, isTallCreative
            const timers = []

            const monitor = visibilityMonitor(window, elem, {
              percentagechange: monitor => {
                const elHeight = elem.offsetHeight
                const wh = window.innerHeight
                isTallCreative = elHeight > wh * 2

                if (isTallCreative) {
                  document.addEventListener(
                    'scroll',
                    () => onScroll(elem),
                    true
                  )
                  onScroll(elem)
                  return monitor.stop()
                }

                let timer
                if (monitor.state().percentage * 100 >= VISIBILITY_THRESHOLD) {
                  if (timer) return

                  timer = setTimeout(() => {
                    sendImpressionEvent(elem)
                    monitor.stop()
                  }, VISIBILITY_TIME_MS)
                } else {
                  clearTimeout(timer)
                  timer = null
                }
              }
            })
            setTimeout(() => monitor.start(), 0)

            function onScroll (elem) {
              const elHeight = elem.offsetHeight
              const wh = window.innerHeight

              if (!stepsTable) {
                const stepsCountMin = (Math.trunc(elHeight / wh) + 1) * 10
                stepsTable = []
                const calcStepsCount = calculateBestStepsCount(
                  elHeight,
                  stepsCountMin
                )
                const calcStepSize = Math.trunc(elHeight / calcStepsCount)
                stepsTable = [[0, calcStepSize - 1]]
                for (let j = 1; j < calcStepsCount; j++) {
                  const [, y2] = stepsTable[j - 1]
                  j !== calcStepsCount
                    ? stepsTable.push([y2 + 1, y2 + calcStepSize])
                    : stepsTable.push([y2 + 1, elHeight])
                }
              }
              const rect = elem.getBoundingClientRect()
              stepsTable.forEach((value, i) => {
                if (value === 'visible') return

                const [htop, hbottom] = value
                if (
                  rect.y + htop >= 0 &&
                  rect.y + hbottom > 0 &&
                  rect.y + htop < wh &&
                  rect.y + hbottom <= wh
                ) {
                  if (!timers[i]) {
                    timers[i] = setTimeout(() => {
                      stepsTable[i] = 'visible'
                      const percentage =
                        calculateVisibilityPercentage(stepsTable)
                      if (percentage * 100 >= VISIBILITY_THRESHOLD) {
                        elem.removeEventListener('scroll', onScroll, false)
                        sendImpressionEvent(elem)
                        timers.map(t => t && clearTimeout(t))
                      }
                    }, VISIBILITY_TIME_MS)
                  }
                } else {
                  clearTimeout(timers[i])
                  timers[i] = null
                }
              })
            }
          }
        }

        const href = createHref(ad, macros)
        ad.zoneId = eventData.zoneId
        return { ad, href, listeners, template }
      })
      cb(null, data)
    })
  })
}

function calculateVisibilityPercentage (table) {
  const percentage =
    table.reduce((accu, next) => {
      next === 'visible' && accu++
      return accu
    }, 0) / table.length
  return percentage
}

function calculateBestStepsCount (l, initCount) {
  let min = l
  let index = 0
  for (let i = 0; i < 10; i++) {
    const remainder = l % (i + initCount)
    if (min > remainder) {
      index = i
      min = remainder
    }
  }

  return index + initCount
}

function createHref (ad, macros) {
  return template.applyTemplate(ad.url, macros)
}

function getMacros (ad, extraParams) {
  const { adverseClickId, clickId, properties, adId, _index } = ad
  const { utcHour, visitorHour } = getHours(extraParams.timestamp)

  return {
    ...extraParams,

    ...properties,
    adId,
    clickId,
    adverseClickId,
    creativeId: ad.id,
    ClickId: clickId,
    _index,

    utcHour,
    visitorHour,
    siteUrl: encodeURIComponent(window.location.href),
    siteQueryString: window.location.search.slice(1)
  }
}

function getScriptNode (window) {
  return document.currentScript
}

function getHeadNode (window) {
  const head =
    window.document.head || window.document.getElementsByTagName('head')[0]
  return head
}

function sanitizeEmptyValues (obj) {
  const isEmpty = /^\s*$/
  return Object.entries(obj).reduce(function (accu, [key, value]) {
    if (typeof value === 'string' && isEmpty.test(value)) accu[key] = undefined
    return accu
  }, obj)
}

function getHours (timestamp) {
  let date
  try {
    date = new Date(timestamp)
  } catch (err) {
    debug('invalid timestamp: ' + timestamp)
    date = new Date()
  }

  return {
    utcHour: date.getUTCHours(),
    visitorHour: date.getHours()
  }
}

function extractCtaAttributes (el) {
  if (!el) return {}

  let currentElement = el
  let index = 0
  while (currentElement && index <= 1) {
    const ctaData = Object.fromEntries(
      Object.entries(currentElement.dataset || {})
        .filter(([key]) => key !== 'lincxCta' && key.startsWith('lincxCta'))
        .map(([key, value]) => {
          const stripped = key.replace(/^lincxCta/, 'cta')
          return [stripped, value]
        })
    )

    if (Object.keys(ctaData).length > 0) {
      return ctaData
    }

    currentElement = currentElement.parentElement
    index++
  }

  return {}
}

function renderCreativeVariables (ad, variables) {
  const {
    name,
    url,
    advertiserId,
    adGroupId,
    clickId,
    adverseClickId,
    properties,
    id,
    adId,
    ...creativeFields
  } = ad
  const tmpl = JSON.stringify(creativeFields || {})
  const rendered = mustache.render(tmpl, {
    ...variables,
    href: ad.url ? mustache.render(ad.url, { ...variables }) : undefined
  })
  Object.assign(ad, JSON.parse(rendered))
}
