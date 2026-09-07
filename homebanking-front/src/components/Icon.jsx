// Set de íconos SVG (estilo lucide, stroke 2)
const paths = {
  home:      <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M9 21v-6h6v6" /></>,
  send:      <><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></>,
  deposit:   <><rect x="2" y="6" width="20" height="13" rx="2" /><circle cx="12" cy="12.5" r="3" /><path d="M6 6V4h12v2" /></>,
  history:   <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
  user:      <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10.3" r="2.3" /><path d="M5.8 16c0-1.9 1.4-3.1 3.2-3.1s3.2 1.2 3.2 3.1" /><path d="M14.5 9h3" /><path d="M14.5 12.5h3" /></>,
  mail:      <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="m3.5 6.7 8.5 6.8 8.5-6.8" /></>,
  logout:    <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>,
  eye:       <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff:    <><path d="m3 3 18 18" /><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.9 3.8" /><path d="M6.6 6.6A16.7 16.7 0 0 0 2 12s3.5 7 10 7c1.4 0 2.7-.3 3.9-.8" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  copy:      <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>,
  check:     <path d="m4 12.5 5.5 5.5L20 6.5" />,
  alert:     <><path d="M12 2 1 21h22L12 2z" /><path d="M12 9v5" /><path d="M12 17.5v.5" /></>,
  info:      <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8v.5" /></>,
  lock:      <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
  arrowDown: <><path d="M12 4v16" /><path d="m6 14 6 6 6-6" /></>,
  arrowUp:   <><path d="M12 20V4" /><path d="m6 10 6-6 6 6" /></>,
  leaf:      <><path d="M11 20A7 7 0 0 1 4 13c0-5 4-9 16-10-1 12-5 17-9 17z" /><path d="M4 21c2-3 5-6 9-8" /></>,
  inbox:     <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" /></>,
  shield:    <><path d="M12 2 4 5.5v6C4 16.5 7.5 20.5 12 22c4.5-1.5 8-5.5 8-10.5v-6L12 2z" /></>,
  edit:      <><path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></>,
  x:         <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  key:       <><circle cx="7" cy="12" r="4" /><path d="M11 12h9" /><path d="M17 12v3" /><path d="M20 12v2" /></>,
  swap:      <><path d="m17 4 4 4-4 4" /><path d="M21 8H7" /><path d="m7 12-4 4 4 4" /><path d="M3 16h14" /></>,
  search:    <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
  star:      <path d="m12 3 2.7 5.6 6.2.9-4.5 4.4 1.1 6.1-5.5-2.9-5.5 2.9 1.1-6.1L3.1 9.5l6.2-.9L12 3z" />,
  chevronRight: <path d="m9 5 7 7-7 7" />,
  arrowLeft: <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>,
  userPlus:  <><circle cx="10" cy="8" r="4" /><path d="M2 21c0-4 3.5-6 8-6 1.4 0 2.7.2 3.8.6" /><path d="M19 8v6" /><path d="M16 11h6" /></>,
  camera:    <><path d="M3 8a2 2 0 0 1 2-2h2l1.5-2.5h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" /><circle cx="12" cy="13" r="3.5" /></>,
  loan:      <><path d="M6 2.5h8l4 4V20a1.2 1.2 0 0 1-1.2 1.2H6A1.2 1.2 0 0 1 4.8 20V3.7A1.2 1.2 0 0 1 6 2.5z" /><path d="M14 2.5v4h4" /><path d="m9 16.5 6-6" /><circle cx="9.6" cy="10.1" r="1" fill="currentColor" /><circle cx="14.4" cy="14.9" r="1" fill="currentColor" /></>,
  card:      <><rect x="2" y="5" width="20" height="14" rx="2.5" /><path d="M2 9.5h20" /><path d="M6 15h4" /></>,
  chat:      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
  insurance: <><path d="M12 2.5 4.5 5.5v6c0 5 3.5 8.5 7.5 10 4-1.5 7.5-5 7.5-10v-6L12 2.5z" /><path d="m9 12 2.2 2.2L15.5 10" /></>,
  vault:     <><rect x="3" y="7" width="18" height="14" rx="2.5" /><path d="M8 7V5.5A4 4 0 0 1 12 1.5a4 4 0 0 1 4 4V7" /><circle cx="12" cy="14" r="2.3" /><path d="M12 16.3V18" /></>,
  sun:       <><circle cx="12" cy="12" r="4" /><path d="M12 2v2.5" /><path d="M12 19.5V22" /><path d="M4.2 4.2 6 6" /><path d="m18 18 1.8 1.8" /><path d="M2 12h2.5" /><path d="M19.5 12H22" /><path d="M4.2 19.8 6 18" /><path d="m18 6 1.8-1.8" /></>,
  moon:      <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5a8.5 8.5 0 1 0 10.8 10.8z" />,
  droplet:   <path d="M12 2.5s7 8 7 12.5a7 7 0 0 1-14 0c0-4.5 7-12.5 7-12.5z" />,
  bolt:      <path d="M12.5 2 4 14h6l-1 8 8.5-12h-6l1-8z" />,
  flame:     <path d="M12 2.5c1 3-3 4.5-3 8a3 3 0 0 0 6 0c0-1-.5-2-1-2.5.5 3 3 3.5 3 6.5a5 5 0 0 1-10 0c0-5 3.5-6.5 5-12z" />,
  receipt:   <><path d="M6 2h12v20l-2.5-1.5L13 22l-2-1.5L9 22l-2.5-1.5L4 22V4a2 2 0 0 1 2-2z" /><path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h5" /></>,
  phone:     <><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></>,
  megaphone: <><path d="M3 11v2a2 2 0 0 0 2 2h1l2.5 5.5L11 20l-1.5-5" /><path d="M8 13V6l11-3.5v14L8 13z" /><path d="M19 8.5c1.2.6 2 1.8 2 3s-.8 2.4-2 3" /></>,
  trending:  <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
};

export default function Icon({ name, size = 20, strokeWidth = 2, className = '', style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {paths[name] || null}
    </svg>
  );
}
