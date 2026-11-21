// Avatares ilustrados (SVG próprio). Formas simples e quadradas, no estilo da marca.
const E = (x, y, r = 4.5) => `<rect x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" fill="#181818"/>`;
const shine = (x, y) => `<rect x="${x}" y="${y}" width="2.4" height="2.4" fill="#fff"/>`;
const eyes = (y = 46, d = 13, r = 4.5) => E(50 - d, y, r) + E(50 + d, y, r) + shine(50 - d + 0.5, y - 3) + shine(50 + d + 0.5, y - 3);

const A = {
  capivara: {
    nome: 'Capivara', bg: '#cc0000',
    svg: `<rect x="22" y="22" width="12" height="10" fill="#6b4a32"/><rect x="66" y="22" width="12" height="10" fill="#6b4a32"/>
      <rect x="20" y="28" width="60" height="58" fill="#9a6b47"/>
      <rect x="28" y="58" width="44" height="28" fill="#7d5538"/>
      ${E(37, 45, 3.5)}${E(63, 45, 3.5)}
      <rect x="33" y="40" width="9" height="3" fill="#7d5538"/><rect x="58" y="40" width="9" height="3" fill="#7d5538"/>
      <rect x="38" y="64" width="6" height="4" fill="#3d2a1c"/><rect x="56" y="64" width="6" height="4" fill="#3d2a1c"/>
      <rect x="44" y="76" width="12" height="3" fill="#3d2a1c"/>
      <rect x="40" y="10" width="20" height="9" fill="#e5e5e5"/><rect x="47" y="6" width="6" height="6" fill="#cc0000"/>`
  },
  preguica: {
    nome: 'Preguiça', bg: '#e5e5e5',
    svg: `<rect x="18" y="20" width="64" height="66" fill="#8c7b6b"/>
      <rect x="26" y="34" width="48" height="44" fill="#d9c8b0"/>
      <rect x="27" y="40" width="18" height="12" fill="#5a4a3c" transform="rotate(-12 36 46)"/>
      <rect x="55" y="40" width="18" height="12" fill="#5a4a3c" transform="rotate(12 64 46)"/>
      <rect x="32" y="45" width="7" height="2.5" fill="#181818"/><rect x="61" y="45" width="7" height="2.5" fill="#181818"/>
      <rect x="45" y="56" width="10" height="6" fill="#3a2e25"/>
      <rect x="42" y="68" width="16" height="3" fill="#3a2e25"/>
      <text x="74" y="22" font-size="12" font-family="sans-serif" fill="#181818">z</text><text x="82" y="14" font-size="9" font-family="sans-serif" fill="#181818">z</text>`
  },
  gato: {
    nome: 'Gato', bg: '#181818',
    svg: `<polygon points="20,40 24,12 42,30" fill="#e8913a"/><polygon points="80,40 76,12 58,30" fill="#e8913a"/>
      <rect x="18" y="28" width="64" height="58" fill="#e8913a"/>
      <rect x="30" y="28" width="6" height="14" fill="#c46f22"/><rect x="47" y="28" width="6" height="14" fill="#c46f22"/><rect x="64" y="28" width="6" height="14" fill="#c46f22"/>
      <rect x="30" y="58" width="40" height="24" fill="#f6e4cf"/>
      ${eyes(50, 14, 5)}
      <rect x="46" y="60" width="8" height="5" fill="#cc0000"/>
      <rect x="10" y="64" width="18" height="2" fill="#181818"/><rect x="72" y="64" width="18" height="2" fill="#181818"/>`
  },
  cachorro: {
    nome: 'Cachorro', bg: '#cc0000',
    svg: `<rect x="12" y="26" width="16" height="36" fill="#5b3b24"/><rect x="72" y="26" width="16" height="36" fill="#5b3b24"/>
      <rect x="24" y="20" width="52" height="64" fill="#c9965e"/>
      <rect x="52" y="30" width="18" height="20" fill="#f1e2c9"/>
      ${eyes(44, 12, 4.5)}
      <rect x="34" y="58" width="32" height="22" fill="#f1e2c9"/>
      <rect x="44" y="58" width="12" height="8" fill="#181818"/>
      <rect x="45" y="72" width="10" height="12" fill="#e86a7a"/>`
  },
  coruja: {
    nome: 'Coruja', bg: '#e5e5e5',
    svg: `<polygon points="18,24 30,12 34,30" fill="#4a3b62"/><polygon points="82,24 70,12 66,30" fill="#4a3b62"/>
      <rect x="18" y="22" width="64" height="66" fill="#5d4a7c"/>
      <rect x="22" y="32" width="26" height="26" fill="#e5e5e5"/><rect x="52" y="32" width="26" height="26" fill="#e5e5e5"/>
      ${E(35, 45, 6)}${E(65, 45, 6)}${shine(35, 41)}${shine(65, 41)}
      <polygon points="44,58 56,58 50,68" fill="#f2b233"/>
      <rect x="30" y="72" width="40" height="3" fill="#4a3b62"/><rect x="34" y="78" width="32" height="3" fill="#4a3b62"/>`
  },
  sapo: {
    nome: 'Sapo', bg: '#181818',
    svg: `<rect x="18" y="20" width="26" height="24" fill="#5fa047"/><rect x="56" y="20" width="26" height="24" fill="#5fa047"/>
      <rect x="23" y="25" width="16" height="15" fill="#e5e5e5"/><rect x="61" y="25" width="16" height="15" fill="#e5e5e5"/>
      ${E(31, 33, 4)}${E(69, 33, 4)}
      <rect x="14" y="40" width="72" height="46" fill="#5fa047"/>
      <rect x="26" y="60" width="48" height="4" fill="#2f5a22"/><rect x="22" y="56" width="6" height="4" fill="#2f5a22"/><rect x="72" y="56" width="6" height="4" fill="#2f5a22"/>
      <rect x="20" y="48" width="8" height="6" fill="#e86a7a"/><rect x="72" y="48" width="8" height="6" fill="#e86a7a"/>`
  },
  panda: {
    nome: 'Panda', bg: '#cc0000',
    svg: `<rect x="14" y="14" width="22" height="22" fill="#181818"/><rect x="64" y="14" width="22" height="22" fill="#181818"/>
      <rect x="18" y="24" width="64" height="62" fill="#f4f4f4"/>
      <rect x="27" y="38" width="18" height="20" fill="#181818" transform="rotate(-10 36 48)"/>
      <rect x="55" y="38" width="18" height="20" fill="#181818" transform="rotate(10 64 48)"/>
      <rect x="35" y="45" width="5" height="5" fill="#f4f4f4"/><rect x="60" y="45" width="5" height="5" fill="#f4f4f4"/>
      <rect x="44" y="62" width="12" height="7" fill="#181818"/>
      <rect x="49" y="69" width="2" height="6" fill="#181818"/><rect x="42" y="74" width="16" height="2" fill="#181818"/>`
  },
  raposa: {
    nome: 'Raposa', bg: '#e5e5e5',
    svg: `<polygon points="14,48 18,10 42,30" fill="#d9531e"/><polygon points="86,48 82,10 58,30" fill="#d9531e"/>
      <polygon points="21,36 22,20 34,30" fill="#181818"/><polygon points="79,36 78,20 66,30" fill="#181818"/>
      <polygon points="14,30 86,30 86,58 50,90 14,58" fill="#d9531e"/>
      <polygon points="14,56 50,62 86,56 50,90" fill="#f6efe6"/>
      ${eyes(48, 15, 4.5)}
      <rect x="45" y="78" width="10" height="7" fill="#181818"/>`
  },
  pinguim: {
    nome: 'Pinguim', bg: '#181818',
    svg: `<rect x="16" y="14" width="68" height="74" fill="#2a3442"/>
      <rect x="26" y="30" width="48" height="58" fill="#f4f4f4"/>
      <rect x="40" y="24" width="20" height="12" fill="#f4f4f4"/>
      ${eyes(46, 11, 4.5)}
      <polygon points="42,56 58,56 50,66" fill="#f2a12e"/>
      <rect x="28" y="60" width="8" height="5" fill="#f2a6b0"/><rect x="64" y="60" width="8" height="5" fill="#f2a6b0"/>
      <rect x="16" y="6" width="68" height="10" fill="#cc0000"/><rect x="44" y="0" width="12" height="8" fill="#e5e5e5"/>`
  },
  porco: {
    nome: 'Porquinho', bg: '#cc0000',
    svg: `<polygon points="18,34 22,14 38,26" fill="#e88a9a"/><polygon points="82,34 78,14 62,26" fill="#e88a9a"/>
      <rect x="16" y="24" width="68" height="62" fill="#f2aab6"/>
      ${eyes(44, 15, 4)}
      <rect x="34" y="54" width="32" height="20" fill="#e88a9a"/>
      <rect x="40" y="60" width="6" height="8" fill="#9c4a58"/><rect x="54" y="60" width="6" height="8" fill="#9c4a58"/>
      <rect x="42" y="78" width="16" height="3" fill="#9c4a58"/>`
  },
  urso: {
    nome: 'Urso', bg: '#e5e5e5',
    svg: `<rect x="14" y="12" width="22" height="22" fill="#6e4a2e"/><rect x="64" y="12" width="22" height="22" fill="#6e4a2e"/>
      <rect x="19" y="17" width="12" height="12" fill="#c48c5c"/><rect x="69" y="17" width="12" height="12" fill="#c48c5c"/>
      <rect x="18" y="22" width="64" height="64" fill="#8a5d3a"/>
      ${eyes(44, 14, 4)}
      <rect x="34" y="54" width="32" height="24" fill="#c48c5c"/>
      <rect x="44" y="56" width="12" height="7" fill="#181818"/>
      <rect x="40" y="68" width="20" height="3" fill="#181818"/>
      <rect x="62" y="6" width="26" height="8" fill="#181818"/><rect x="66" y="0" width="18" height="8" fill="#181818"/>`
  },
  polvo: {
    nome: 'Polvo', bg: '#181818',
    svg: `<rect x="20" y="12" width="60" height="50" fill="#cc0000"/>
      ${[22, 34, 46, 58, 70].map((x, i) => `<rect x="${x}" y="58" width="8" height="${22 + (i % 2) * 8}" fill="#cc0000"/>`).join('')}
      <rect x="26" y="20" width="10" height="6" fill="#e04a4a"/>
      <rect x="27" y="34" width="16" height="14" fill="#e5e5e5"/><rect x="57" y="34" width="16" height="14" fill="#e5e5e5"/>
      ${E(37, 42, 4)}${E(63, 42, 4)}
      <rect x="44" y="52" width="12" height="3" fill="#181818"/>`
  }
};

// cor do "corpo" de cada bicho na corrida do ranking
const BODY = {
  capivara: '#9a6b47', preguica: '#8c7b6b', gato: '#e8913a', cachorro: '#c9965e', coruja: '#5d4a7c', sapo: '#5fa047',
  panda: '#f4f4f4', raposa: '#d9531e', pinguim: '#2a3442', porco: '#f2aab6', urso: '#8a5d3a', polvo: '#cc0000'
};

// Bichinho correndo: corpo + pernas animadas + cabeça do avatar escolhido
export function runnerSVG(key, size = 64) {
  const a = A[key] || A.capivara;
  const c = BODY[key] || '#9a6b47';
  return `<svg class="runner-svg" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
    <g class="r-legs-back"><rect class="leg l1" x="30" y="72" width="9" height="22" fill="${c}" style="filter:brightness(.7)"/><rect class="leg l2" x="58" y="72" width="9" height="22" fill="${c}" style="filter:brightness(.7)"/></g>
    <rect x="22" y="56" width="52" height="24" fill="${c}"/>
    <rect class="tail" x="14" y="58" width="10" height="6" fill="${c}"/>
    <g class="r-legs-front"><rect class="leg l3" x="36" y="74" width="9" height="22" fill="${c}"/><rect class="leg l4" x="64" y="74" width="9" height="22" fill="${c}"/></g>
    <g transform="translate(48 18) scale(.5)"><rect width="100" height="100" fill="${a.bg}"/>${a.svg}</g>
  </svg>`;
}

// Jeremias: o mascote que pergunta como está o dia
export const JEREMIAS_SVG = `<svg viewBox="0 0 100 100" width="100%" height="100%" role="img" aria-label="Jeremias">
  <rect width="100" height="100" fill="#cc0000"/>
  <rect x="20" y="86" width="60" height="14" fill="#181818"/><polygon points="44,86 56,86 53,100 47,100" fill="#e5e5e5"/>
  <rect x="24" y="22" width="52" height="62" fill="#f0c39a"/>
  <rect x="18" y="44" width="8" height="14" fill="#e2ad80"/><rect x="74" y="44" width="8" height="14" fill="#e2ad80"/>
  <rect x="24" y="22" width="52" height="8" fill="#e8b48a"/>
  <rect x="40" y="12" width="3" height="12" fill="#3a2a20" transform="rotate(-18 41 18)"/><rect x="49" y="9" width="3" height="14" fill="#3a2a20"/><rect x="58" y="12" width="3" height="12" fill="#3a2a20" transform="rotate(18 59 18)"/>
  <rect x="27" y="38" width="20" height="16" fill="#e5e5e5" stroke="#181818" stroke-width="3"/><rect x="53" y="38" width="20" height="16" fill="#e5e5e5" stroke="#181818" stroke-width="3"/>
  <rect x="46" y="43" width="8" height="3" fill="#181818"/>
  <rect x="35" y="44" width="6" height="6" fill="#181818"/><rect x="59" y="42" width="6" height="6" fill="#181818"/>
  <rect x="30" y="33" width="14" height="3" fill="#3a2a20" transform="rotate(-8 37 34)"/><rect x="56" y="31" width="14" height="3" fill="#3a2a20" transform="rotate(10 63 32)"/>
  <rect x="46" y="54" width="8" height="8" fill="#e2ad80"/>
  <path d="M28 66 L50 61 L72 66 L66 72 L50 68 L34 72 Z" fill="#3a2a20"/>
  <rect x="44" y="74" width="12" height="4" fill="#9c3b2c"/>
</svg>`;

export const TURTLE_SVG = `<svg class="turtle" viewBox="0 0 40 24" width="30" height="18" aria-hidden="true">
  <rect x="9" y="4" width="20" height="12" fill="#5fa047"/><rect x="13" y="7" width="5" height="5" fill="#3f7a2c"/><rect x="20" y="7" width="5" height="5" fill="#3f7a2c"/>
  <rect x="29" y="8" width="8" height="7" fill="#8cc46f"/><rect x="34" y="10" width="2" height="2" fill="#181818"/>
  <rect class="t-leg a" x="11" y="16" width="4" height="5" fill="#8cc46f"/><rect class="t-leg b" x="23" y="16" width="4" height="5" fill="#8cc46f"/><rect x="5" y="10" width="4" height="3" fill="#8cc46f"/>
</svg>`;

export const AVATARS = Object.keys(A);
export const avatarName = (k) => (A[k] || A.capivara).nome;
export function avatarSVG(key, size = 40) {
  const a = A[key] || A.capivara;
  return `<svg class="avatar" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${a.nome}">
    <rect width="100" height="100" fill="${a.bg}"/>${a.svg}</svg>`;
}
