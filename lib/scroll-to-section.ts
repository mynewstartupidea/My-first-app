// Shared by navbar.tsx and footer.tsx — both render in-page section links
// (#features, #how-it-works, etc.) on pages that don't always have those
// sections (e.g. /pricing only renders the Pricing section, not Features/
// HowItWorks/UseCases/FAQ). A plain <a href="#hash">'s native scroll also
// never accounted for the fixed header, landing the target heading right
// underneath it.
export function scrollToSection(id: string, e: React.MouseEvent): void {
  e.preventDefault()
  const el = document.getElementById(id)
  if (el) {
    const top = el.getBoundingClientRect().top + window.scrollY - 80
    window.scrollTo({ top, behavior: 'smooth' })
    window.history.replaceState(null, '', `#${id}`)
    return
  }
  // Section doesn't exist on this page (e.g. clicked from /pricing) — a
  // silent no-op here felt identical to the original bug report ("nothing
  // happens"). Navigate to the homepage with the hash instead; its native
  // hash-scroll on load still won't account for the fixed header perfectly,
  // but it actually gets the visitor to the right section instead of doing
  // nothing at all.
  window.location.href = `/#${id}`
}
