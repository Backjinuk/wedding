/* 모바일 청첩장 공통 스크립트 (시안 3종 공용) */
(function () {
  const W = window.WEDDING || {};
  const date = new Date(W.date || '2027-02-21T16:00:00+09:00');

  // 캘린더
  document.querySelectorAll('[data-calendar]').forEach((el) => {
    const y = date.getFullYear(), m = date.getMonth(), d = date.getDate();
    const first = new Date(y, m, 1).getDay();
    const last = new Date(y, m + 1, 0).getDate();
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    let html = '<div class="cal-head">' + days.map((x, i) => `<span class="${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${x}</span>`).join('') + '</div><div class="cal-body">';
    for (let i = 0; i < first; i++) html += '<span></span>';
    for (let i = 1; i <= last; i++) {
      const dow = (first + i - 1) % 7;
      const cls = [i === d ? 'on' : '', dow === 0 ? 'sun' : '', dow === 6 ? 'sat' : ''].join(' ').trim();
      html += `<span class="${cls}">${i}</span>`;
    }
    el.innerHTML = html + '</div>';
  });

  // D-day 카운트다운
  const cd = document.querySelectorAll('[data-countdown]');
  const dday = document.querySelectorAll('[data-dday]');
  function tick() {
    const diff = date - new Date();
    const s = Math.max(0, Math.floor(diff / 1000));
    const v = { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
    cd.forEach((el) => {
      el.querySelectorAll('[data-u]').forEach((n) => { n.textContent = String(v[n.dataset.u]).padStart(2, '0'); });
    });
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const t1 = new Date(date); t1.setHours(0, 0, 0, 0);
    const days = Math.round((t1 - t0) / 86400000);
    dday.forEach((el) => { el.textContent = days > 0 ? `D-${days}` : days === 0 ? 'D-DAY' : `D+${-days}`; });
  }
  tick(); setInterval(tick, 1000);

  // 토스트
  const toast = document.createElement('div');
  toast.className = 'toast';
  document.body.appendChild(toast);
  function showToast(msg) {
    toast.textContent = msg; toast.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => toast.classList.remove('show'), 1800);
  }
  window.showToast = showToast;

  // 복사
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); showToast('복사되었습니다'); }
    catch { showToast(b.dataset.copy); }
  });

  // 아코디언
  document.querySelectorAll('[data-acc]').forEach((btn) => {
    btn.addEventListener('click', () => btn.parentElement.classList.toggle('open'));
  });

  // 공유 (더미)
  document.querySelectorAll('[data-share]').forEach((b) => b.addEventListener('click', async () => {
    if (b.dataset.share === 'link') {
      try { await navigator.clipboard.writeText(location.href); showToast('링크가 복사되었습니다'); } catch { showToast(location.href); }
    } else showToast('카카오톡 공유는 SDK 연동 후 동작합니다');
  }));

  // 갤러리 라이트박스
  const imgs = Array.from(document.querySelectorAll('[data-gallery] img'));
  if (imgs.length) {
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = '<button class="lb-close" aria-label="닫기">&times;</button><button class="lb-prev" aria-label="이전">&#8249;</button><img alt=""><button class="lb-next" aria-label="다음">&#8250;</button><div class="lb-count"></div>';
    document.body.appendChild(lb);
    const big = lb.querySelector('img'), cnt = lb.querySelector('.lb-count');
    let idx = 0;
    const show = (i) => {
      idx = (i + imgs.length) % imgs.length;
      big.src = imgs[idx].dataset.full || imgs[idx].src;
      cnt.textContent = `${idx + 1} / ${imgs.length}`;
    };
    imgs.forEach((im, i) => im.addEventListener('click', () => { show(i); lb.classList.add('open'); document.body.style.overflow = 'hidden'; }));
    const close = () => { lb.classList.remove('open'); document.body.style.overflow = ''; };
    lb.querySelector('.lb-close').onclick = close;
    lb.querySelector('.lb-prev').onclick = () => show(idx - 1);
    lb.querySelector('.lb-next').onclick = () => show(idx + 1);
    lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
    let sx = 0;
    lb.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
    });
    document.addEventListener('keydown', (e) => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
  }

  // 스크롤 등장 애니메이션
  const io = new IntersectionObserver((es) => es.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
})();

/* 섹션 단위 스크롤 + 오른쪽 점 내비게이션 (시안 공통)
   - 섹션(화면 한 장)마다 한 번만 멈춤
   - 화면보다 긴 섹션은 안에서 자연스럽게 스크롤되고, 끝에 닿으면 다음 섹션으로 넘어감 */
(function () {
  const wrap = document.querySelector('.wrap');
  if (!wrap) return;
  const MIN_PANEL = 120;   // 이보다 낮은 요소(구분선 등)는 섹션으로 치지 않음
  const DURATION = 700;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const panels = () => Array.from(wrap.children).filter((el) => el.offsetHeight >= MIN_PANEL);
  const topOf = (el) => el.getBoundingClientRect().top + scrollY;
  const maxY = () => document.documentElement.scrollHeight - innerHeight;

  let animating = false;
  function scrollToY(y) {
    y = Math.min(Math.max(0, Math.round(y)), maxY());
    if (reduce) { scrollTo(0, y); return; }
    const from = scrollY, d = y - from, t0 = performance.now();
    if (Math.abs(d) < 2) return;
    animating = true;
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    (function step(now) {
      const p = Math.min(1, (now - t0) / DURATION);
      scrollTo(0, from + d * ease(p));
      if (p < 1) requestAnimationFrame(step); else animating = false;
    })(t0);
  }

  // dir 방향으로 갈 목표 위치. null이면 긴 섹션 안이라 기본 스크롤에 맡김
  function plan(dir) {
    const ps = panels(), y = scrollY, vh = innerHeight;
    let i = 0;
    ps.forEach((p, k) => { if (topOf(p) <= y + 5) i = k; });
    const t = topOf(ps[i]), b = t + ps[i].offsetHeight;
    if (dir > 0) {
      if (b > y + vh + 5) return null;
      return ps[i + 1] ? topOf(ps[i + 1]) : maxY();
    }
    if (t < y - 5) return null;
    const prev = ps[i - 1];
    if (!prev) return 0;
    const pt = topOf(prev);
    return Math.max(pt, pt + prev.offsetHeight - vh);  // 긴 섹션이면 그 끝 화면으로
  }

  const blocked = () => document.querySelector('.modal.open, .lightbox.open');

  // 마우스 휠 / 트랙패드: 한 번의 제스처에 한 섹션만 이동
  let lastWheel = 0, consumed = false, native = false, acc = 0;
  addEventListener('wheel', (e) => {
    if (blocked() || e.ctrlKey) return;
    const now = Date.now(), gap = now - lastWheel;
    lastWheel = now;
    if (gap > 220) { consumed = false; native = false; acc = 0; }
    if (native) return;
    if (animating || consumed) { e.preventDefault(); return; }
    const dir = Math.sign(e.deltaY);
    if (!dir) return;
    const target = plan(dir);
    if (target === null) { native = true; return; }
    e.preventDefault();
    acc += e.deltaY;
    if (Math.abs(acc) > 25) { scrollToY(target); consumed = true; acc = 0; }
  }, { passive: false });

  // 터치: 세로 스와이프만 처리, 가로 스와이프(갤러리 슬라이더)는 그대로 둠
  let sx = 0, sy = 0, mode = null, target = null;
  addEventListener('touchstart', (e) => {
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; mode = null;
  }, { passive: true });
  addEventListener('touchmove', (e) => {
    if (blocked()) return;
    const dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
    if (mode === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      if (Math.abs(dx) >= Math.abs(dy)) mode = 'x';
      else { target = plan(dy < 0 ? 1 : -1); mode = target === null ? 'native' : 'snap'; }
    }
    if (mode === 'snap') e.preventDefault();
  }, { passive: false });
  addEventListener('touchend', (e) => {
    if (blocked() || mode !== 'snap' || animating) return;
    if (Math.abs(e.changedTouches[0].clientY - sy) > 40) scrollToY(target);
  });

  // 키보드
  addEventListener('keydown', (e) => {
    if (blocked() || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const dir = ['ArrowDown', 'PageDown', ' '].includes(e.key) ? 1 : ['ArrowUp', 'PageUp'].includes(e.key) ? -1 : 0;
    if (!dir) return;
    const t = plan(dir);
    if (t === null) return;
    e.preventDefault();
    if (!animating) scrollToY(t);
  });

  // 오른쪽 점 내비게이션
  const navTargets = panels().filter((el) => /^(HEADER|SECTION|FOOTER)$/.test(el.tagName));
  const labelOf = (el) => {
    if (el.dataset.nav) return el.dataset.nav;
    if (el.tagName === 'HEADER') return 'Main';
    if (el.tagName === 'FOOTER') return 'Thanks';
    const h = el.querySelector('.sec-head .kicker, .sec-head .en, .title, .label, h2');
    return h ? h.textContent.replace(/^\s*\d+\s*[—-]\s*/, '').trim() : '';
  };
  const pager = document.createElement('nav');
  pager.className = 'pager';
  pager.setAttribute('aria-label', '섹션 이동');
  const label = document.createElement('span');
  label.className = 'pager-label';
  document.body.append(pager, label);
  const dots = navTargets.map((el) => {
    const b = document.createElement('button');
    b.setAttribute('aria-label', labelOf(el));
    b.addEventListener('click', () => scrollToY(topOf(el)));
    pager.appendChild(b);
    return b;
  });
  let cur = -1, hideT;
  function update() {
    const mid = scrollY + innerHeight * 0.4;
    let i = 0;
    navTargets.forEach((el, k) => { if (topOf(el) <= mid) i = k; });
    if (i === cur) return;
    cur = i;
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    const r = dots[i].getBoundingClientRect();
    label.textContent = labelOf(navTargets[i]);
    label.style.top = r.top + r.height / 2 + 'px';
    label.classList.add('show');
    clearTimeout(hideT); hideT = setTimeout(() => label.classList.remove('show'), 1200);
  }
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
})();
