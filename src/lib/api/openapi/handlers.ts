// Static manifest of every handler module. Importing this file triggers
// each handler's top-level `registerRoute(...)` call, populating the shared
// registry. The OpenAPI generator script imports this manifest before
// serialising the spec; v1 route files don't need to (they import their
// handler directly, which also triggers registration as a side-effect).
//
// When a new handler is added, append its module path here.

import "../handlers/auth/login";
import "../handlers/auth/refresh";
import "../handlers/auth/logout";
import "../handlers/auth/me";
import "../handlers/auth/register";
import "../handlers/auth/send-otp";
import "../handlers/auth/verify-otp";
import "../handlers/auth/reset-password";
import "../handlers/devices/register";
import "../handlers/devices/unregister";
import "../handlers/rides/list";
import "../handlers/rides/get";
