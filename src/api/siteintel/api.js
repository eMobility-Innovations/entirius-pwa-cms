import { siteintelApi } from "./client";
import { useLeadsChannelStore } from "@/stores/leadsChannel";

// django-siteintel admin API v2 — audits of a company domain (plan 14).
const base = () => `/api/siteintel/v2/admin/${useLeadsChannelStore().activeChannelIdx}`;

export const GET_LatestAudit = async (domain) => {
  const { data } = await siteintelApi.get(`${base()}/audits/`, { params: { domain, ordering: "-created_at" } });
  const latest = data.results?.[0];
  return latest ? (await siteintelApi.get(`${base()}/audits/${latest.id}/`)).data : null;
};

export const POST_AuditRerun = (id) => siteintelApi.post(`${base()}/audits/${id}/rerun/`, {});
