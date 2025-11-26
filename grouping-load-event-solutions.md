## 🚀 NEW: Advanced Auto-Detection Solutions

These two solutions automatically detect whether grouping exists and handle both cases dynamically, without requiring pre-configuration. Perfect for scenarios where the same script renders templates with and without grouping.

---

## Solution A: Event-Driven with Smart Fallback (Best for Reliability)

Listens for custom events from grouping scripts, with intelligent fallback detection.

### How It Works

1. **Event Listener**: Listen for `adsGroupingComplete` custom event
2. **Function Check**: Check if grouping function exists in DOM
3. **DOM Analysis**: Analyze rendered ads for grouping indicators
4. **Smart Timeout**: Adaptive timeout based on detection

### Implementation

**Step 1: Add after line 22:**

```javascript
module.exports = displayAd
module.exports.prepareDataForRender = prepareDataForRender

// ===== EVENT-DRIVEN GROUPING CONTROL =====
window.__adsLoadEventQueue = window.__adsLoadEventQueue || []
window.__adsLoadEventsEnabled = false
window.__adsGroupingDetected = false

function processQueuedLoadEvents() {
  if (window.__adsLoadEventsEnabled) return
  
  window.__adsLoadEventsEnabled = true
  
  // Clear timeouts
  if (window.__adsLoadEventTimeout) {
    clearTimeout(window.__adsLoadEventTimeout)
    window.__adsLoadEventTimeout = null
  }
  
  // Process queue
  if (window.__queuedLoadEvents && window.__queuedLoadEvents.length > 0) {
    window.__queuedLoadEvents.forEach(({ sendLoadEvent }) => {
      sendLoadEvent()
    })
    window.__queuedLoadEvents = []
  }
}

// Listen for grouping completion event
window.addEventListener('adsGroupingComplete', function() {
  window.__adsGroupingDetected = true
  processQueuedLoadEvents()
}, { once: true })

// Expose function for grouping scripts
window.enableAdsLoadEvents = processQueuedLoadEvents

// Function to detect if grouping might exist
function detectGrouping(mountTarget) {
  // Check 1: Look for grouping function in scripts
  const scripts = Array.from(document.scripts)
  const hasGroupingFunction = scripts.some(script => {
    return script.textContent && script.textContent.includes('groupWithLimitAdsByGroupOffer')
  })
  
  // Check 2: Look for data-group-offer attributes
  const hasGroupOfferAttrs = mountTarget.querySelectorAll('[data-group-offer]').length > 0
  
  // Check 3: Look for data-rank attributes (grouping completed)
  const hasRankAttrs = mountTarget.querySelectorAll('[data-rank]').length > 0
  
  return hasGroupingFunction || hasGroupOfferAttrs || hasRankAttrs
}
// ===== END EVENT-DRIVEN GROUPING CONTROL =====
```

**Step 2: Modify `prepareDataForRender` around line 184-217:**

```javascript
const data = { template, zoneId: options.zoneId }
if (result.segmentId) {
  data.segmentId = result.segmentId
}

// ===== EVENT-DRIVEN GROUPING DETECTION =====
const scriptNode = getScriptNode(window)
const mountTarget = scriptNode?.parentNode || document.body

// Initialize queue
window.__queuedLoadEvents = window.__queuedLoadEvents || []
window.__adsLoadEventsEnabled = false

// Detect if grouping might exist
const mightHaveGrouping = detectGrouping(mountTarget)

// Set adaptive timeout based on detection
let timeout = 100 // Default: no grouping, fire quickly
if (mightHaveGrouping) {
  timeout = 2500 // Grouping detected, wait longer
  window.__adsGroupingDetected = true
}

// Set fallback timeout
window.__adsLoadEventTimeout = setTimeout(() => {
  if (!window.__adsLoadEventsEnabled) {
    // Double-check: if we see data-rank attributes now, grouping happened
    const rankCount = mountTarget.querySelectorAll('[data-rank]').length
    if (rankCount > 0 && !window.__adsGroupingDetected) {
      // Grouping happened but no event fired - wait a bit more
      setTimeout(processQueuedLoadEvents, 300)
    } else {
      // No grouping or already processed
      processQueuedLoadEvents()
    }
  }
}, timeout)
// ===== END EVENT-DRIVEN GROUPING DETECTION =====

data.ads = ads.map(function (ad, rank) {
  // ... existing code until line 212 ...
  
  const sendLoadEvent = once((event, adNode) => {
    const loadEventPayload = {
      ...adEventData,
      rank: adNode.dataset.rank || adEventData.rank
    }
    
    const sendEvent = () => {
      api.sendLoadEvent(apiUrl, loadEventPayload)
    }
    
    // Queue if grouping might exist and not yet enabled
    if (mightHaveGrouping && !window.__adsLoadEventsEnabled) {
      if (!window.__queuedLoadEvents) {
        window.__queuedLoadEvents = []
      }
      window.__queuedLoadEvents.push({
        sendLoadEvent: sendEvent,
        event,
        adNode
      })
    } else {
      // No grouping or already enabled - send immediately
      sendEvent()
    }
  })
  
  // ... rest of existing code (lines 218-344) ...
})

cb(null, data)
```

**Step 3: In grouping script:**

```javascript
function groupWithLimitAdsByGroupOffer() {
  // ... existing grouping logic ...
  
  // Dispatch completion event
  window.dispatchEvent(new CustomEvent('adsGroupingComplete', {
    detail: { timestamp: Date.now() }
  }))
  
  // Also call exposed function (redundant but safe)
  if (typeof window.enableAdsLoadEvents === 'function') {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.enableAdsLoadEvents()
      })
    })
  }
}

groupWithLimitAdsByGroupOffer()
```

### Pros
- ✅ **Event-driven** - Clean separation of concerns
- ✅ **Smart detection** - Multiple detection methods
- ✅ **Adaptive timeout** - Adjusts based on detection
- ✅ **Works without grouping** - Handles both cases

### Cons
- ⚠️ Requires grouping script to dispatch event (or use fallback)

---

## Solution B: Smart Queue with Stability Detection (Best Balance)

Queues events and detects DOM stability to determine when grouping completes.

### How It Works

1. **Queue All Events**: Initially queue all load events
2. **Monitor DOM**: Watch for DOM changes
3. **Stability Detection**: Detect when DOM becomes stable (no changes for period)
4. **Rank Verification**: Verify data-rank attributes are set
5. **Auto-Process**: Process queue when stable

### Implementation

**Step 1: Add after line 22:**

```javascript
module.exports = displayAd
module.exports.prepareDataForRender = prepareDataForRender

// ===== SMART QUEUE WITH STABILITY DETECTION =====
window.__adsLoadEventQueue = window.__adsLoadEventQueue || []
window.__adsLoadEventsEnabled = false
window.__adsStabilityMonitor = null

function processQueuedLoadEvents() {
  if (window.__adsLoadEventsEnabled) return
  
  window.__adsLoadEventsEnabled = true
  
  // Stop monitoring
  if (window.__adsStabilityMonitor) {
    window.__adsStabilityMonitor.stop()
    window.__adsStabilityMonitor = null
  }
  
  // Clear timeout
  if (window.__adsLoadEventTimeout) {
    clearTimeout(window.__adsLoadEventTimeout)
    window.__adsLoadEventTimeout = null
  }
  
  // Process queue
  if (window.__queuedLoadEvents && window.__queuedLoadEvents.length > 0) {
    window.__queuedLoadEvents.forEach(({ sendLoadEvent }) => {
      sendLoadEvent()
    })
    window.__queuedLoadEvents = []
  }
}

// Expose function for grouping scripts
window.enableAdsLoadEvents = processQueuedLoadEvents

// Stability monitor
function createStabilityMonitor(mountTarget, onStable) {
  let changeCount = 0
  let stableCount = 0
  let lastChangeTime = Date.now()
  
  const checkStability = () => {
    const now = Date.now()
    const timeSinceLastChange = now - lastChangeTime
    
    // If no changes for 500ms and we've seen changes, consider stable
    if (changeCount > 0 && timeSinceLastChange > 500) {
      stableCount++
      if (stableCount >= 2) {
        onStable()
        return
      }
    } else {
      stableCount = 0
    }
    
    // Continue checking
    requestAnimationFrame(checkStability)
  }
  
  const observer = new MutationObserver(() => {
    changeCount++
    lastChangeTime = Date.now()
    stableCount = 0
  })
  
  observer.observe(mountTarget, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-rank', 'data-group-offer']
  })
  
  // Start stability check
  requestAnimationFrame(checkStability)
  
  return {
    stop: () => {
      observer.disconnect()
    }
  }
}
// ===== END SMART QUEUE WITH STABILITY DETECTION =====
```

**Step 2: Modify `prepareDataForRender` around line 184-217:**

```javascript
const data = { template, zoneId: options.zoneId }
if (result.segmentId) {
  data.segmentId = result.segmentId
}

// ===== SMART QUEUE WITH STABILITY DETECTION =====
const scriptNode = getScriptNode(window)
const mountTarget = scriptNode?.parentNode || document.body

// Initialize queue
window.__queuedLoadEvents = window.__queuedLoadEvents || []
window.__adsLoadEventsEnabled = false

// Start stability monitoring
if (!window.__adsStabilityMonitor) {
  window.__adsStabilityMonitor = createStabilityMonitor(mountTarget, () => {
    // DOM is stable - check if grouping happened
    const rankCount = mountTarget.querySelectorAll('[data-rank]').length
    const groupOfferCount = mountTarget.querySelectorAll('[data-group-offer]').length
    
    // If we have ranks or group offers, grouping likely happened
    if (rankCount > 0 || groupOfferCount > 0) {
      // Give a tiny delay to ensure all ranks are set
      setTimeout(processQueuedLoadEvents, 100)
    } else {
      // No grouping detected - process immediately
      processQueuedLoadEvents()
    }
  })
  
  // Fallback timeout
  window.__adsLoadEventTimeout = setTimeout(() => {
    if (!window.__adsLoadEventsEnabled) {
      processQueuedLoadEvents()
    }
  }, 3000) // 3 second max wait
}
// ===== END SMART QUEUE WITH STABILITY DETECTION =====

data.ads = ads.map(function (ad, rank) {
  // ... existing code until line 212 ...
  
  const sendLoadEvent = once((event, adNode) => {
    const loadEventPayload = {
      ...adEventData,
      rank: adNode.dataset.rank || adEventData.rank
    }
    
    const sendEvent = () => {
      api.sendLoadEvent(apiUrl, loadEventPayload)
    }
    
    // Always queue initially - will be processed when stable
    if (!window.__adsLoadEventsEnabled) {
      if (!window.__queuedLoadEvents) {
        window.__queuedLoadEvents = []
      }
      window.__queuedLoadEvents.push({
        sendLoadEvent: sendEvent,
        event,
        adNode
      })
    } else {
      // Already enabled - send immediately
      sendEvent()
    }
  })
  
  // ... rest of existing code (lines 218-344) ...
})

cb(null, data)
```

**Step 3: In grouping script (optional):**

```javascript
function groupWithLimitAdsByGroupOffer() {
  // ... existing grouping logic ...
  
  // Optional: Signal completion early
  if (typeof window.enableAdsLoadEvents === 'function') {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.enableAdsLoadEvents()
      })
    })
  }
}

groupWithLimitAdsByGroupOffer()
```

### Pros
- ✅ **Automatic detection** - No configuration needed
- ✅ **Stability-based** - Waits for DOM to stabilize
- ✅ **Handles both cases** - Works with or without grouping
- ✅ **Balanced approach** - Good performance and reliability

### Cons
- ⚠️ Uses MutationObserver and requestAnimationFrame

---

## Comparison: New Auto-Detection Solutions

| Solution | Auto-Detection | Configuration | Complexity | Best For |
|----------|---------------|---------------|------------|----------|
| **B: Event-Driven** | ✅ Partial | ⚠️ Optional | Medium | Event-based architectures |
| **C: Stability Detection** | ✅ Full | ❌ None | Medium-High | Balanced reliability |

## Recommendation

**For your use case** (same script, different templates with/without grouping):

- **Best Choice: Solution A (Event-Driven)** - Clean separation, smart detection, adaptive timeout. Works well if grouping scripts can dispatch events.
- **Alternative: Solution B (Stability Detection)** - Fully automatic, detects DOM stability. Best if you want zero configuration and don't want to modify grouping scripts.

Both solutions work without requiring data attributes or pre-configuration, making them perfect for dynamic template rendering.
