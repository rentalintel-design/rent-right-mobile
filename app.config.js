/** @type {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY ?? 'AIzaSyBz-4Hjy23o_LFJ6214sTWE7WgoBI7F5MM'

  return {
    ...config,
    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        googleMapsApiKey,
      },
    },
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
  }
}
