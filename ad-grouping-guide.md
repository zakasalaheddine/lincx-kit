# Ad Grouping Feature Guide

This guide will walk you through implementing the ad grouping feature in your templates. This feature allows you to reorder ads based on priority groups and apply limits to specific groups.

## Overview

The grouping feature:
- **Reorders ads** according to a priority configuration
- **Applies limits** to specific groups (optional)
- **Handles ungrouped ads** by placing them at the bottom
- **Assigns rank attributes** (`data-rank`) to all ads based on their final position

## Step-by-Step Implementation

### Step 1: Add the Grouping Function to Your Template

Copy the `groupWithLimitAdsByGroupOffer()` function into your template's `<script>` section. You can place it anywhere in your script tag, typically near other initialization functions.

```javascript
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
```

### Step 2: Configure Your Group Priorities

Update the `config` array at the top of the function to match your grouping needs:

```javascript
const config = [
  { groupKey: 'high' },                    // Shows all ads with groupKey 'high'
  { groupKey: 'medium-high', limit: 2 },  // Shows only first 2 ads with groupKey 'medium-high'
  { groupKey: 'medium', limit: 3 },       // Shows only first 3 ads with groupKey 'medium'
  { groupKey: 'medium-low', limit: 4 }    // Shows only first 4 ads with groupKey 'medium-low'
]
```

**Configuration Rules:**
- **Order matters**: Ads will be displayed in the order you specify in the config array
- **Without `limit`**: If you omit the `limit` property, all ads with that `groupKey` will be shown
- **With `limit`**: Only the specified number of ads will be shown (taken from the beginning of that group)

### Step 3: Add `data-group-offer` Attribute to Your Ad Elements

Add the `data-group-offer` attribute to each ad element in your template. The value should match one of the `groupKey` values in your config.

**Example using Handlebars/Mustache:**

```html
{{#ads}}
<div class="offer__card" id="{{adId}}" data-group-offer="{{ groupOffer }}">
  <!-- Your ad content here -->
</div>
{{/ads}}
```

**Example with static values:**

```html
<div class="offer__card" id="{{adId}}" data-group-offer="high">
  <!-- High priority ad -->
</div>

<div class="offer__card" id="{{adId}}" data-group-offer="medium">
  <!-- Medium priority ad -->
</div>
```

### Step 4: Handle Ungrouped Ads (Optional)

Ads can be ungrouped in two ways:

1. **No `data-group-offer` attribute**: Elements without the attribute will be placed at the bottom
2. **Empty `data-group-offer` value**: Elements with `data-group-offer=""` will also be placed at the bottom

```html
<!-- This ad will appear at the bottom -->
<div class="offer__card">
  <!-- No data-group-offer attribute -->
</div>

<!-- This ad will also appear at the bottom -->
<div class="offer__card" data-group-offer="">
  <!-- Empty data-group-offer value -->
</div>
```

**Note**: Ungrouped ads are **not subject to any limits** and will all be displayed at the bottom.

### Step 5: Call the Function After Ads Are Dynamically Loaded

Because your ads are dynamically loaded, you should call the `groupWithLimitAdsByGroupOffer()` function immediately after the ads have been inserted into the DOM. Make sure this function runs each time new ads are rendered. For example:

```javascript
// After your ads are inserted or updated in the DOM:
groupWithLimitAdsByGroupOffer();
```

## Complete Example

Here's a complete example showing how to integrate the grouping feature:

```html
<div class="offers__container" id="ads-container">
  {{#ads}}
  <div class="offer__card" id="{{adId}}" data-group-offer="{{ groupOffer }}">
    <h2>{{{ headline }}}</h2>
    <p>{{{ sub_headline }}}</p>
    <!-- More ad content -->
  </div>
  {{/ads}}
</div>

<script>
  function groupWithLimitAdsByGroupOffer() {
    const config = [
      { groupKey: 'high' },
      { groupKey: 'medium-high', limit: 2 },
      { groupKey: 'medium', limit: 3 },
      { groupKey: 'medium-low', limit: 4 }
    ]

    // ... (function code from Step 1)
  }
  groupWithLimitAdsByGroupOffer();
</script>
```

## How It Works

1. **Collection**: The function finds all elements with `data-group-offer` attribute
2. **Separation**: It separates grouped ads (with non-empty values) from ungrouped ads (no attribute or empty value)
3. **Grouping**: Grouped ads are organized by their `groupOffer` value
4. **Reordering**: Ads are reordered according to your config array
5. **Limiting**: Limits are applied to groups that have a `limit` specified
6. **Ranking**: Each ad receives a `data-rank` attribute (starting from 0) based on its final position
7. **Ungrouped Placement**: All ungrouped ads are appended at the bottom with no limits

## Understanding `data-rank`

After the function runs, each ad will have a `data-rank` attribute indicating its position:

- **Grouped ads**: Ranked 0, 1, 2, ... based on config order and limits
- **Ungrouped ads**: Continue the ranking sequence at the bottom

Example:
- Rank 0-2: "high" group ads (all 3 shown)
- Rank 3-4: "medium-high" group ads (limited to 2)
- Rank 5-7: "medium" group ads (limited to 3)
- Rank 8+: Ungrouped ads (all shown)

## Troubleshooting

### Ads aren't reordering
- **Check**: Make sure the function is called after ads are rendered
- **Check**: Verify that `data-group-offer` attributes are correctly set
- **Check**: Ensure the parent container is correctly identified

### Limits aren't working
- **Check**: Verify your config array has `limit` properties set correctly
- **Check**: Make sure the `groupKey` values match the `data-group-offer` values exactly

### Ungrouped ads aren't appearing
- **Check**: Ensure elements without `data-group-offer` are direct children of the parent container
- **Note**: If you need to filter which elements are considered "ads", you may need to adjust the selector in the function (see the comment in the code)

### Wrong order
- **Check**: Verify your config array order matches your desired display order
- **Check**: Ensure `groupKey` values match exactly (case-sensitive)

## Advanced: Customizing the Selector

If your ungrouped ads need a more specific selector (e.g., they have a common class), you can modify this line in the function:

```javascript
// Current implementation (all direct children)
const ungroupedAdsArray = allChildren.filter(item => !item.hasAttribute('data-group-offer'))

// Example: Only select elements with a specific class
const ungroupedAdsArray = Array.from(parentElement.querySelectorAll('.ad-item:not([data-group-offer])'))
```
