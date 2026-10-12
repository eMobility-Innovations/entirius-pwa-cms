import axios from "axios";
import { api } from "./client";

import { PWATrimmerNormalizer } from "../../utils/normalizers/content-normalizers";

import { slugBuilder } from "../../utils/normalizers/assets-normalizers";

const _CHANNEL = process.env.VUE_APP_CHANNEL;

const contentDb = "/api-admin/contentdb/v1";
const accounts = `/api/accounts/v1/${_CHANNEL ?? ''}`;

//
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
// --- AUTH -------------- LOGIN
export const POST_Login = async ({ username = null, password = null }) => {
  const url = `${accounts}/customer/tokens/`;

  // `sensitive`: the password and the answered token pair stay out of the debug log (createClient).
  return api.post(url, { email: username, password }, { sensitive: true });
};
//
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
// --- AUTH -------------- LOGOUT
// Plain axios, never `api`: its refresh interceptors would refresh the very session this request ends.
export const POST_Logout = async ({ access, refresh }) => {
  const url = `${process.env.VUE_APP_API_URL}${accounts}/customer/tokens/blacklist/`;

  return axios.post(url, { refresh }, { headers: { Authorization: `Bearer ${access}` }, timeout: 5000 });
};
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
// -- GET USER DETAILS
export const GET_UserDetails = async ({ uid }) => {
  const url = `${accounts}/customer/${uid}/profile/`;
  return api.get(url);
};
//
// -- PATCH USER PROFILE
export const PATCH_UserProfile = async ({ uid, payload }) => {
  const url = `${accounts}/customer/${uid}/profile/`;
  return api.patch(url, payload);
};
//
// -- CHANGE PASSWORD (authenticated)
export const POST_PasswordChange = async ({ old_password, new_password, new_password_check }) => {
  const url = `${accounts}/customer/password/change/`;
  return api.post(url, { old_password, new_password, new_password_check });
};
//
// -- FORGOT PASSWORD (send reset email)
export const POST_PasswordReset = async ({ email }) => {
  const url = `${accounts}/customer/password/reset/`;
  return api.post(url, { email });
};
//
// -- RESET PASSWORD CONFIRM (from email link)
export const POST_PasswordResetConfirm = async ({ key, new_password, new_password_check }) => {
  const url = `${accounts}/customer/password/reset/${key}/`;
  return api.post(url, { new_password, new_password_check });
};
//
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
// --- get LIST OF DOCUMENTS or SINGLE
export const GET_Content = async ({
  type = null,
  uid = "",
  limit = 6,
  page = 1,
  CDB_TYPE = "content",
  //language = 'PL'
  ...rest
}) => {
  const url = `${contentDb}/${CDB_TYPE}/${type}/${uid ? `${uid}/` : ``}`;
  return api.get(url, {
    params: {
      limit,
      page,
      ...rest,
      //language
    },
  });
};
//
//
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
// --- post NEW DOCUMENT
export const POST_Content = async ({
  type = "",
  attributes = {},
  content = null,
  language = null,
  extension = null,
  meta = {},
  routes = [],
  name = "",
  CDB_TYPE = "content",
  channels = null,
}) => {
  const url = `${contentDb}/${CDB_TYPE}/${type}/`;

  const body = {
    attributes,
    routes,
    name,
    content: PWATrimmerNormalizer(content),
    language,
    extension,
    meta,
  };
  if (channels !== null) body.channels = channels;
  return api.post(url, body);
};
//
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
// --- post NEW DOCUMENT
export const PUT_Content = async ({
  type = "",
  attributes = null,
  content = null,
  language = null,
  extension = null,
  meta = {},
  uid = "",
  routes = [],
  name = "",
  CDB_TYPE = "content",
  channels = null,
}) => {
  const url = `${contentDb}/${CDB_TYPE}/${type}/${uid}/`;

  const body = {
    attributes,
    routes,
    name,
    content: PWATrimmerNormalizer(content),
    language,
    extension,
    meta,
  };
  if (channels !== null) body.channels = channels;
  return api.put(url, body);
};
//
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
// -- delete DOCUMENT
export const DELETE_Content = async ({
  type = null,
  uid = "",
  CDB_TYPE = "content",
}) => {
  const url = `${contentDb}/${CDB_TYPE}/${type}/${uid}/`;

  return api.delete(url);
};
//
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
// -- post DOCUMENT with published flag
export const PUBLISH_Content = async ({
  type = "",
  attributes = {},
  content = null,
  extension = null,
  meta = {},
  uid = "",
  routes = [],
  name = "",
  CDB_TYPE = "content",
  channels = null,
}) => {
  const url = `${contentDb}/${CDB_TYPE}/${type}/${uid}/published/`;

  const body = {
    attributes,
    routes,
    name,
    content: PWATrimmerNormalizer(content),
    extension,
    meta,
  };
  if (channels !== null) body.channels = channels;
  return api.post(url, body);
};
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
//
// -- GET Published List
export const GET_PublishedList = async ({
  type = "",
  uid = "",
  CDB_TYPE = "content",
}) => {
  const url = `${contentDb}/${CDB_TYPE}/${type}/${uid}/published/`;
  return api.get(url);
};
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
//
// -- DELETE Published draft
export const DELETE_Published = async ({
  type = "",
  uid = "",
  CDB_TYPE = "content",
}) => {
  const url = `${contentDb}/${CDB_TYPE}/${type}/${uid}/published/`;
  return api.delete(url);
};

//
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
// -- get DOCUMENT TYPE
export const GET_ContentTypes = async ({ CDB_TYPE = "content" }) => {
  const url = `${contentDb}/${CDB_TYPE}-types/`;
  return api.get(url);
};
//
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
//
// -- get IMAGES
export const GET_Images = async ({ limit = 9, tags = [], page = 1 }) => {
  const url = `${contentDb}/images/`;

  return api.get(url, {
    params: {
      page,
      limit,
      tags,
    },
  });
};
//
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
//
// -- post IMAGE
export const POST_Image = async ({ tags = [], meta = null, image = null }) => {
  const url = `${contentDb}/images/`;

  return api.post(url, {
    image,
    meta,
    tags,
  });
};
//
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
//
// -- post IMAGE
export const DELETE_Image = async ({ uid = "" }) => {
  const url = `${contentDb}/images/${uid}/`;
  return api.delete(url);
};
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
//
// -- get IMAGE TAGS
export const GET_ImageTags = async ({ limit = 999, slug = '' }) => {
  const url = `${contentDb}/image-tags/${slug}`;
  // const limit = 20;

  return api.get(url, {
    params: {
      limit,
    },
  });
};
// 
export const GET_Image = async ({  slug = '' }) => {
  const url = `${contentDb}/images/${slug}`;
  // const limit = 20;

  return api.get(url, {
    params: {
    },
  });
};
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
//
// -- post IMAGE TAG
export const POST_ImageTags = async ({ label = "" }) => {
  const url = `${contentDb}/image-tags/`;
  return api.post(url, {
    slug: slugBuilder(label),
    label,
  });
};
// -- PUT IMAGE TAG
export const PUT_ImageTags = async ({ uid = '', tags = [] }) => {
  const url = `${contentDb}/images/${uid}/`;
  return api.put(url, {
    tags: tags
  });
};
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
//
// -- DELETE IMAGE TAG
export const DELETE_ImageTags = async ({ slug = "" }) => {
  const url = `${contentDb}/image-tags/${slug}/`;
  return api.delete(url);
};
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
//
// -- GET USER INFO / PERMISSIONS
export const GET_User = async ({}) => {
  const url = `${contentDb}/content-permissions/`;
  return api.get(url);
};
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
//
// -- GET CONTENT ROUTES FOR STATICS
export const GET_Navigation = async ({}) => {
  const url = `${contentDb}/routes/`;
  return api.get(url);
};
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
//
// -- POST NEW ROUTE
export const POST_Route = async ({
  url = "",
  label = "",
  placement = "top",
}) => {
  const reqUrl = `${contentDb}/routes/`;
  return api.post(reqUrl, {
    url,
    label,
    placement,
  });
};
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
//
// -- EDIT ROUTE
export const PUT_Route = async ({
  originURL = "",
  url = "",
  label = "",
  placement = "top",
}) => {
  const reqUrl = `${contentDb}/routes/${originURL}/`;
  return api.put(reqUrl, {
    url,
    label,
    placement,
  });
};
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
//
// -- DELETE ROUTE
export const DELETE_Route = async ({ contentUrl = "" }) => {
  const url = `${contentDb}/routes/${contentUrl}/`;

  return api.delete(url);
};
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
//
// -- GET CONTENTDB ATTRS LIST
export const GET_AttrsList = async () => {
  const url = `${contentDb}/attributes/`;

  return api.get(url);
};
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
//
// -- GET CONTENTDB ATTR VALUES
export const GET_AttrsValues = async ({ slug = "" }) => {
  const url = `${contentDb}/attributes/${slug}/values/`;

  return api.get(url);
};
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
//
// -- POST CONTENTDB VALUE TO ATTR
export const POST_AttrValue = async ({ slug = "", value = "" }) => {
  const url = `${contentDb}/attributes/${slug}/values/`;

  return api.post(url, { value });
};
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
//
// -- POST CONTENTDB VALUE TO ATTR
export const DELETE_AttrValue = async ({ slug = "", id = null }) => {
  const url = `${contentDb}/attributes/${slug}/values/${id}/`;

  return api.delete(url);
};

//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
// --- get LIST OF DOCUMENTS or SINGLE
export const GET_Languages = async ({ limit = 6, page = 1 }) => {
  const url = `${contentDb}/languages/`;
  return api.get(url, {
    params: {
      limit,
      page,
    },
  });
};
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
// --- get CHANNELS
export const GET_ContentChannels = async ({ limit = 100, page = 1 }) => {
  const url = `${contentDb}/channels/`;
  return api.get(url, {
    params: {
      limit,
      page,
    },
  });
};
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
// --- get CONTENT SETS
export const GET_ContentSets = async ({
  type = null,
  uid = null,
  page = 1,
  limit = 6,
  ...rest
}) => {
  const url = `${contentDb}/content-sets/${uid ? `${uid}/` : ``}`;
  return api.get(url, {
    params: {
      page,
      limit,
      ...rest,
    },
  });
};
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
// --- post CONTENT SETS
export const POST_ContentSet = async ({ type = null, members = [] }) => {
  const url = `${contentDb}/content-sets/`;
  return api.post(url, { members });
};
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
// --- put CONTENT SETS
export const PUT_ContentSet = async ({
  type = null,
  uid = null,
  members = [],
}) => {
  const url = `${contentDb}/content-sets/${uid}/`;
  return api.put(url, { members });
};
//
//
//
// -------------------------------------------------------------------------------------------------
//
//
//
//
// --- put CONTENT SETS
export const DELETE_ContentSet = async ({ type = null, uid = null }) => {
  const url = `${contentDb}/content-sets/${uid}/`;
  return api.delete(url);
};

// Uni

// --- AUTHORS (v2 admin)
export const GET_Authors = (params) => api.get("/api/contentdb/v2/admin/authors/", { params });
export const GET_Author = (uid) => api.get(`/api/contentdb/v2/admin/authors/${uid}/`);
export const POST_Author = (data) => api.post("/api/contentdb/v2/admin/authors/", data);
export const PATCH_Author = (uid, data) => api.patch(`/api/contentdb/v2/admin/authors/${uid}/`, data);
export const DELETE_Author = (uid, data) => api.delete(`/api/contentdb/v2/admin/authors/${uid}/`, { data });

export const _METHOD_content = ({
  method = "post",
  url = null,
  payload = null,
  uid = null,

  ...options
}) => {
  const _url = `${contentDb}${url}`;
  // -----------------------------------------
  // -----------------------------------------

  const config = [options];
  // -----------------------------------------
  // -----------------------------------------

  let _payload = payload;
  if (method === "delete") {
    // --- delete payload needs to be treated diff...
    // -----------------------------------------
    // -----------------------------------------
    _payload = {
      data: {
        ...payload,
      },
    };
  }
  // modify config
  // -----------------------------------------
  // -----------------------------------------
  if (_payload) config.unshift(_payload);
  return api[method](_url, ...[...config]);
};
