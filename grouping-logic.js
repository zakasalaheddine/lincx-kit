function groupWithLimitAdsByGroupOffer() {
  const config = [
    { groupKey: 'high' },
    { groupKey: 'medium-high', limit: 2 },
    { groupKey: 'medium', limit: 3 },
    { groupKey: 'medium-low', limit: 4 }
  ]

  // Get all ads with data-group-offer attribute
  const groupedAdsItems = document.querySelectorAll('[data-group-offer]')
  const allGroupedAdsArray = Array.from(groupedAdsItems)
  
  if (allGroupedAdsArray.length === 0) return

  const parentElement = allGroupedAdsArray[0].parentElement
  if (!parentElement) return

  // Separate ads with empty data-group-offer values (treat them as ungrouped)
  const groupedAdsArray = []
  const emptyGroupOfferAds = []
  
  allGroupedAdsArray.forEach(item => {
    const groupOffer = item.dataset.groupOffer
    // If data-group-offer is empty or whitespace, treat as ungrouped
    if (!groupOffer || groupOffer.trim() === '') {
      emptyGroupOfferAds.push(item)
    } else {
      groupedAdsArray.push(item)
    }
  })

  // Get all ads without data-group-offer
  // Note: Adjust the selector below to match your ad elements (e.g., '.offer__card', '.listicle', etc.)
  // For now, we'll get all direct children that don't have data-group-offer
  // You may need to add a more specific selector if ads have a common class
  const allChildren = Array.from(parentElement.children)
  const ungroupedAdsArray = allChildren.filter(item => !item.hasAttribute('data-group-offer'))
  
  // Combine ungrouped ads with ads that have empty data-group-offer values
  const allUngroupedAds = [...ungroupedAdsArray, ...emptyGroupOfferAds]

  // Group ads by their groupOffer value
  const groupedAds = groupedAdsArray.reduce((acc, item) => {
    const group = item.dataset.groupOffer
    if (!acc[group]) {
      acc[group] = []
    }
    acc[group].push(item)
    return acc
  }, {})

  // Remove all ads from DOM temporarily
  groupedAdsArray.forEach(ad => ad.remove())
  allUngroupedAds.forEach(ad => ad.remove())

  // Track rank index starting from 0
  let rank = 0

  // Reorder and limit ads according to config order
  config.forEach(groupConfig => {
    const { groupKey, limit } = groupConfig
    const adsInGroup = groupedAds[groupKey] || []
    
    // Apply limit if specified, otherwise show all ads in this group
    const adsToShow = limit != null ? adsInGroup.slice(0, limit) : adsInGroup
    
    // Append ads in config order with data-rank attribute
    adsToShow.forEach(ad => {
      ad.setAttribute('data-rank', rank)
      parentElement.appendChild(ad)
      rank++
    })
  })

  // Append ungrouped ads at the bottom (no limits applied) with data-rank attribute
  // This includes ads without data-group-offer and ads with empty data-group-offer values
  allUngroupedAds.forEach(ad => {
    ad.setAttribute('data-rank', rank)
    parentElement.appendChild(ad)
    rank++
  })
}
