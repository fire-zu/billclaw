/**
 * Config schema export wrapper for OpenClaw plugin
 *
 * Re-exports the TypeBox configuration schema from the main config module.
 * This file exists to satisfy the OpenClaw plugin manifest's expectation
 * of a separate config.schema.js file.
 */

export { billclawConfigSchema as default } from "./config.js";
