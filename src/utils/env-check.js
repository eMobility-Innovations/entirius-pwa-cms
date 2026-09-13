const ENV_VARS = [
  {
    key: 'VUE_APP_API_URL',
    value: process.env.VUE_APP_API_URL,
    required: true,
    label: 'API URL',
    description: 'Backend API base URL (ContentDB + PIM)'
  },
  {
    key: 'VUE_APP_CHANNEL',
    value: process.env.VUE_APP_CHANNEL,
    required: true,
    label: 'Channel',
    description: 'Content channel identifier'
  },
  {
    key: 'VUE_APP_DEBUG',
    value: process.env.VUE_APP_DEBUG,
    required: false,
    label: 'Debug',
    description: 'Enable API debug logging (true/false)'
  },
  {
    key: 'VUE_APP_LANG',
    value: process.env.VUE_APP_LANG,
    required: false,
    label: 'Language',
    description: 'Interface language (EN or PL)'
  },
  {
    key: 'VUE_APP_USERNAME',
    value: process.env.VUE_APP_USERNAME,
    required: false,
    label: 'Username',
    description: 'Dev auto-login username'
  },
  {
    key: 'VUE_APP_PASSWORD',
    value: process.env.VUE_APP_PASSWORD,
    required: false,
    label: 'Password',
    description: 'Dev auto-login password'
  },
  {
    key: 'VUE_APP_PANELS',
    value: process.env.VUE_APP_PANELS,
    required: false,
    label: 'Panels',
    description: 'Fallback panel IDs (comma-separated). Primary source: Munin API'
  },
  {
    key: 'VUE_APP_SSO_API_BASE',
    value: process.env.VUE_APP_SSO_API_BASE,
    required: false,
    label: 'SSO API base',
    description: 'Path of the backend SSO endpoints; set to show "Log in with SSO" (docs/sso-login.md)'
  }
]

const errors = ENV_VARS.filter(v => v.required && !v.value)
const warnings = ENV_VARS.filter(v => !v.required && !v.value)
const valid = errors.length === 0

if (errors.length || warnings.length) {
  console.group('%c[env-check] Environment validation', 'font-weight:bold')
  errors.forEach(v => {
    console.error(`MISSING REQUIRED: ${v.key} -- ${v.description}`)
  })
  warnings.forEach(v => {
    console.warn(`missing optional: ${v.key} -- ${v.description}`)
  })
  console.groupEnd()
}

export const envStatus = { valid, errors, warnings }
