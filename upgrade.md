
I would like to improve the preview script basically by mimicing exactly what zone script do and instead of using mock ads we will use the one comes from the api, this should happens as follow:
1. Call the lookup script to load the user location and make sure to update the personlized items based on the user request

curl 'https://api.lincx.com/geometer/api/lookup' \
  -H 'accept: application/json' \
  -H 'origin: https://poweredbylincx.com' \

2. Call the ads api to load the ads for the zone with the user location updating the link and passing the zoneId 

curl 'https://api.lincx.com/api/a?zoneId=[ZONEID]&href=https%253A%252F%252Fpoweredbylincx.com%252Fclients%252Fpreview%252Fpcle%252Flisting-top8wl-01&geoCity=[GEO_CITY]&geoRegion=[GEO_REGION]&geoState=[GEO_STATE]&geoIP=[GEO_IP]&geoPostal=[GEO_POSTAL]&geoCountry=[GEO_COUNTRY]&geoCountryName=[GEO_COUNTRY_NAME]&timestamp=[TIMESTAMP]&zoneLoadEventId=[ZONE_LOAD_EVENT_ID]&test-mode=' \
  -H 'accept: application/json' \
  -H 'origin: https://poweredbylincx.com' \


3. the response object will have ads array use that to run the preview script instead of usinc mock ads