(function () {
  function pickRandomUnique(items, count) {
    const safeItems = Array.isArray(items) ? items.filter(Boolean) : []
    if (safeItems.length <= count) return safeItems

    const indices = safeItems.map((_, index) => index)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }

    return indices.slice(0, count).map((index) => safeItems[index])
  }

  function createTestimonialCard({ comment, name, date }) {
    const card = document.createElement('div')
    card.className = 'card'

    const cardContent = document.createElement('div')
    cardContent.className = 'card-content'

    const p = document.createElement('p')
    p.textContent = `"${comment ?? ''}"`

    const cite = document.createElement('cite')
    const who = (name ?? '').trim()
    const when = (date ?? '').trim()
    cite.textContent = `- ${[who, when].filter(Boolean).join(', le ')}`

    cardContent.appendChild(p)
    cardContent.appendChild(cite)
    card.appendChild(cardContent)

    return card
  }

  function renderRandomTestimonials() {
    const grid = document.getElementById('testimonials-grid')
    if (!grid) return

    const testimonials = window.testimonials || window.tesimonials || []

    grid.innerHTML = ''
    const mq = window.matchMedia ? window.matchMedia('(max-width: 768px)') : null
    const isMobile = !!(mq && mq.matches)
    const chosen = pickRandomUnique(testimonials, isMobile ? 1 : 2)

    if (chosen.length === 0) return

    const shuffleBtn = document.createElement('button')
    shuffleBtn.type = 'button'
    shuffleBtn.className = 'testimonials-shuffle-btn'
    shuffleBtn.setAttribute('aria-label', 'Afficher deux nouveaux témoignages')
    shuffleBtn.title = 'Afficher deux nouveaux témoignages'

    const icon = document.createElement('img')
    icon.className = 'testimonials-shuffle-icon'
    icon.src = 'assets/shuffle.svg'
    icon.alt = ''
    icon.setAttribute('aria-hidden', 'true')
    shuffleBtn.appendChild(icon)

    shuffleBtn.addEventListener('click', renderRandomTestimonials)

    if (isMobile) {
      grid.appendChild(shuffleBtn)
      grid.appendChild(createTestimonialCard(chosen[0]))
      return
    }

    grid.appendChild(createTestimonialCard(chosen[0]))
    grid.appendChild(shuffleBtn)
    if (chosen.length > 1) grid.appendChild(createTestimonialCard(chosen[1]))
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderRandomTestimonials)
  } else {
    renderRandomTestimonials()
  }

  try {
    const mq = window.matchMedia ? window.matchMedia('(max-width: 768px)') : null
    if (mq && typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', renderRandomTestimonials)
    } else if (mq && typeof mq.addListener === 'function') {
      mq.addListener(renderRandomTestimonials)
    }
  } catch {
    // ignore
  }
})()
