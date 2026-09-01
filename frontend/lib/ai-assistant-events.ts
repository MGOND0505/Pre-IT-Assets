// Shared window event name connecting the super admin sidebar's "Open Assistant" card to its
// cross-org search widget (super-admin-ai-assistant.tsx). Kept as a named constant, not an inline
// string, so the dispatcher and listener can never drift out of sync.
export const OPEN_SUPER_ADMIN_AI_ASSISTANT_EVENT = "open-super-admin-ai-assistant"
