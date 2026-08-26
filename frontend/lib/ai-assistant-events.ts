// Shared window event names connecting each sidebar's "Open Assistant" card to the actual
// assistant panel (rendered once at the dashboard layout root, not inside the sidebar itself -
// see ai-assistant-sidebar-card.tsx for why they're decoupled this way). Kept as named
// constants, not inline strings, so the dispatcher and listener can never drift out of sync.
export const OPEN_AI_ASSISTANT_EVENT = "open-ai-assistant"
export const OPEN_SUPER_ADMIN_AI_ASSISTANT_EVENT = "open-super-admin-ai-assistant"
