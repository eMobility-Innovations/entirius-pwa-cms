import { muninApi } from './client'

export const GET_Modules = () => muninApi.get('/api/munin/v2/')
export const GET_ConfigHealth = () => muninApi.get('/api/munin/v2/health/')
export const POST_ConfigHealthCheck = () => muninApi.post('/api/munin/v2/health/check/')
