/**
 * Config UI hints export wrapper for OpenClaw plugin
 *
 * Re-exports the UI hints object from the main config module.
 * This file exists to satisfy the OpenClaw plugin manifest's expectation
 * of a separate config-ui-hints.js file.
 */

export { billclawUiHints as default } from "./config.js";
