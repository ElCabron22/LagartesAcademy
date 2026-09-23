// Configurações globais de suporte (WhatsApp) — valores padrão e normalização.
// Usado tanto no servidor (API) quanto no navegador (botões).

export const SUPPORT_DEFAULTS = {
  whatsapp_number: '',
  default_message: 'Olá, gostaria de adquirir este módulo.',
  button_text: 'Falar no WhatsApp',
  locked_message: 'Este módulo ainda não está liberado para você. Fale com o suporte para adquirir o acesso.',
  float_text: 'Precisa de ajuda?',
  show_float: true,
}

export function normalizeSupport(row) {
  const r = row || {}
  const number = String(r.whatsapp_number || '').replace(/\D/g, '')
  return {
    whatsapp_number: number,
    default_message: r.default_message ?? SUPPORT_DEFAULTS.default_message,
    button_text: r.button_text || SUPPORT_DEFAULTS.button_text,
    locked_message: r.locked_message || SUPPORT_DEFAULTS.locked_message,
    float_text: r.float_text ?? SUPPORT_DEFAULTS.float_text,
    show_float: r.show_float !== false,
    configured: number.length >= 10,
  }
}

// Monta o link wa.me. Se a mensagem tiver {modulo}, substitui pelo título; senão, anexa o título.
export function whatsappLink(support, moduleTitle) {
  if (!support?.whatsapp_number) return null
  let text = String(support.default_message || '')
  if (moduleTitle) {
    text = text.includes('{modulo}') ? text.replace(/\{modulo\}/g, moduleTitle) : `${text} Módulo: ${moduleTitle}`.trim()
  } else {
    text = text.replace(/\{modulo\}/g, '').trim()
  }
  return `https://wa.me/${support.whatsapp_number}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}
