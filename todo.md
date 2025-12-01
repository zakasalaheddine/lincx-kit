- [ ] Review the current template structure in `templates/5d31zn/i5gaye/template.html` and identify all ad-related elements/classes.
- [ ] List and document the specific ad/zone components already included in the current template (e.g., banner, ad slots, etc).
- [ ] Analyze how the preview-with-zone currently functions in the lincx template and contrast differences with this template.
- [ ] Plan the integration so that ONLY the ad/zone elements are leveraged, **not** the entire lincx view or layout.
- [ ] Build a zone preview section/component within the current template utilizing only the identified ad/zone elements.
- [ ] Ensure the preview mechanism works: verify relevant JS handles preview rendering using only the ad component(s), not other unrelated content.
- [ ] Test for correct display of zones/ads on both mobile and desktop breakpoints (consult relevant CSS, e.g., `styles.css`).
- [ ] Remove/deprecate any unnecessary lincx or global preview code not relevant to this template.
- [ ] Document integration and any needed tweaks for future maintainers.


<!-- Make the preview script work with the ads from the zone and not uses the zone template -->