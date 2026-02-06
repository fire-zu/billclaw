/**
 * BillClaw OpenClaw Plugin Adapter
 *
 * @packageDocumentation
 */

export { default } from './plugin.js';

// Re-export tools for testing
export {
  plaidSyncTool,
  gmailFetchTool,
  billParseTool,
  conversationalSyncTool,
  conversationalStatusTool,
  conversationalHelpTool,
} from './tools/index.js';
