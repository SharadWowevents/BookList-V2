export const PlusIcon = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const StarIcon = ({ size = 24, className = '', filled = false }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" className={className}>
    <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" />
  </svg>
);

export const GripIcon = ({ className = '' }) => (
  <svg width="14" height="22" viewBox="0 0 14 22" fill="currentColor" className={className}>
    <circle cx="4" cy="5" r="1.8"/>
    <circle cx="10" cy="5" r="1.8"/>
    <circle cx="4" cy="11" r="1.8"/>
    <circle cx="10" cy="11" r="1.8"/>
    <circle cx="4" cy="17" r="1.8"/>
    <circle cx="10" cy="17" r="1.8"/>
  </svg>
);


export const CheckIcon = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 12.5l4.5 4.5L19 7.5"/>
  </svg>
);

export const XIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 6l12 12M18 6L6 18"/>
  </svg>
);

export const MicIcon = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="9" y="3" width="6" height="11" rx="3"/>
    <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/>
  </svg>
);

export const BackIcon = ({ size = 26, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 5l-7 7 7 7"/>
  </svg>
);

export const TrashIcon = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>
  </svg>
);

export const ChevronRightIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className={className}>
    <path d="M9 6l6 6-6 6"/>
  </svg>
);

export const ChevronDownIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className={className}>
    <path d="M6 9l6 6 6-6"/>
  </svg>
);

export const UndoIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 14L4 9l5-5"/>
    <path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>
  </svg>
);

export const RedoIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 14l5-5-5-5"/>
    <path d="M20 9H9.5a5.5 5.5 0 000 11H13"/>
  </svg>
);

export const ColorIcon = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 16L12 3l6 13M8.3 11h7.4"/>
    <rect x="3" y="19" width="18" height="3" rx="1.5" fill="#E2A21A" stroke="none"/>
  </svg>
);

export const UlIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 6h11M9 12h11M9 18h11"/>
    <circle cx="4.5" cy="6" r="1.2" fill="currentColor"/>
    <circle cx="4.5" cy="12" r="1.2" fill="currentColor"/>
    <circle cx="4.5" cy="18" r="1.2" fill="currentColor"/>
  </svg>
);

export const OlIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M10 6h10M10 12h10M10 18h10M4 5l1.5-1v5M3.5 13.5a1.5 1.5 0 113 .5L3.5 17h3"/>
  </svg>
);

export const QuoteIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M4 18v-5.5C4 8.4 6.2 6 9.5 5l.7 1.6C8.2 7.5 7.2 9 7 11h3v7H4zm10 0v-5.5c0-4.1 2.2-6.5 5.5-7.5l.7 1.6c-2 .9-3 2.4-3.2 4.4h3v7h-6z"/>
  </svg>
);

export const CodeIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>
  </svg>
);

export const HrIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 12h18"/>
    <path d="M7 7h10M7 17h10" opacity=".35"/>
  </svg>
);

export const LinkIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1 1"/>
    <path d="M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1-1"/>
  </svg>
);

export const AlignLeftIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>
  </svg>
);

export const AlignCenterIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>
  </svg>
);

export const AlignRightIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>
  </svg>
);

export const IndentIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M10 6h10M10 12h10M10 18h10M3 8l4 4-4 4"/>
  </svg>
);

export const OutdentIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M10 6h10M10 12h10M10 18h10M7 8l-4 4 4 4"/>
  </svg>
);

export const ClearFormatIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 5h11M10.5 5L7 19M15 14l5 5M20 14l-5 5"/>
  </svg>
);

export const PanelIcon = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <path d="M9 4v16" />
  </svg>
);

export const ListPlusIcon = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 6h11M4 12h11M4 18h7M18 14v7M14.5 17.5h7"/>
  </svg>
);

export const NotePlusIcon = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M13 3H7a2 2 0 00-2 2v14a2 2 0 002 2h4"/><path d="M13 3l5 5h-5zM18 8v3M18 14v7M14.5 17.5h7"/>
  </svg>
);

export const ListsIcon = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M10 6h10M10 12h10M10 18h10"/><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M3.5 18l1.5 1.5 2.5-2.5"/>
  </svg>
);

export const NotesIcon = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>
  </svg>
);

export const GearIcon = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
  </svg>
);

export const SunIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
  </svg>
);

export const MoonIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z"/>
  </svg>
);

export const MonitorIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>
  </svg>
);

export const LogoutIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
  </svg>
);

export const ShareIcon = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6"/>
  </svg>
);

export const UsersIcon = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14.5a6.5 6.5 0 013.5 5.5"/>
  </svg>
);

export const EyeIcon = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);

export const PencilIcon = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 20h4L19 9l-4-4L4 16z"/>
  </svg>
);

export const CameraIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 8h3l2-3h6l2 3h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/><circle cx="12" cy="13.5" r="3.5"/>
  </svg>
);

export const ChecklistIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="4" width="6" height="6" rx="1.5"/><path d="M4.6 7l1.1 1.1L7.6 6M13 7h8"/><rect x="3" y="14" width="6" height="6" rx="1.5"/><path d="M13 17h8"/>
  </svg>
);

export const ImageIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M21 16l-5-5-8 9"/>
  </svg>
);

export const DrawIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 16c3-6 5-6 6-3s3 3 5-2 4-5 7-2"/><path d="M4 20.5h16" opacity=".45"/>
  </svg>
);

export const PenIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 4l5 5L9 20H4v-5z"/><path d="M13 6l5 5"/>
  </svg>
);

export const SketchPencilIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M14 6l4 4M5 15l4 4"/>
  </svg>
);

export const MarkerIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M8 14l7-9 4 4-9 7z"/><path d="M8 14l-3 4v1h5l0-3"/><path d="M13 21h8" strokeWidth="3" opacity=".45"/>
  </svg>
);

export const EraserIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M8 20h12"/><path d="M5.5 15.5l9-9a2 2 0 012.8 0l2.2 2.2a2 2 0 010 2.8L13 18H8z"/><path d="M9.5 11.5l5 5"/>
  </svg>
);

export const LassoIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="9" rx="8" ry="5" strokeDasharray="3 2.5"/><path d="M7 12.5c-1.5 2-.5 4 1.5 4s2 2.5 0 4.5"/>
  </svg>
);

export const RulerIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 20L20 4"/><circle cx="4.5" cy="19.5" r="1.6" fill="currentColor"/><circle cx="19.5" cy="4.5" r="1.6" fill="currentColor"/>
  </svg>
);

export const HandIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M8 13V6a1.5 1.5 0 013 0v5M11 11V4.5a1.5 1.5 0 013 0V11M14 11V6.5a1.5 1.5 0 013 0V14c0 4-2.5 7-6 7-2.4 0-4-1.2-5.4-3.4L3.8 13.2a1.5 1.5 0 012.5-1.6L8 14"/>
  </svg>
);

export const DoneIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 12.5l4.5 4.5L19 7.5"/>
  </svg>
);

export const ShieldIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const KeyIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>
  </svg>
);

export const PauseIcon = ({ size = 20, className = '', solid = false }) => (
  solid ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="6" y="4.5" width="4" height="15" rx="1"/>
      <rect x="14" y="4.5" width="4" height="15" rx="1"/>
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>
    </svg>
  )
);

export const PlayIcon = ({ size = 20, className = '', solid = false }) => (
  solid ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M7 4.5v15l12.5-7.5z"/>
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9"/><path d="M10 8.5l5.5 3.5-5.5 3.5z"/>
    </svg>
  )
);

export const RefreshIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 11a8 8 0 00-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0014.3 4.9L20 16M20 20v-4h-4"/>
  </svg>
);

export const GlobeIcon = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>
  </svg>
);

export const DownloadIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>
  </svg>
);

export const CopyIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>
  </svg>
);

export const CrmIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="5" width="18" height="14" rx="2.5"/>
    <circle cx="9" cy="11" r="2.3"/>
    <path d="M5.8 16.5a3.6 3.6 0 016.4 0M14.5 10h4M14.5 13.5h3"/>
  </svg>
);

export const KanbanIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="4" width="5" height="16" rx="1.5"/>
    <rect x="10" y="4" width="5" height="10" rx="1.5"/>
    <rect x="17" y="4" width="4" height="13" rx="1.5"/>
  </svg>
);

export const RowsIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M8 6h13M8 12h13M8 18h13"/>
    <circle cx="4" cy="6" r="1.1" fill="currentColor"/>
    <circle cx="4" cy="12" r="1.1" fill="currentColor"/>
    <circle cx="4" cy="18" r="1.1" fill="currentColor"/>
  </svg>
);

export const ChatIcon = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 20l1.3-3.9A8 8 0 1112 20a8 8 0 01-3.9-1z"/>
    <path d="M9.3 8.6c-.3 2.9 3.2 6.4 6.1 6.1l.4-1.5-1.7-.8-.9 1c-1.2-.5-2.1-1.4-2.6-2.6l1-.9-.8-1.7z"/>
  </svg>
);

export const CalendarIcon = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5"/>
    <path d="M3.5 10h17M8 3v4M16 3v4"/>
  </svg>
);

export const SearchIcon = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="11" cy="11" r="6.5"/>
    <path d="M20 20l-4.2-4.2"/>
  </svg>
);

export const WaveIcon = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2"/>
  </svg>
);

export const AudioPlayIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M7 4.5v15l12.5-7.5z"/>
  </svg>
);

export const AudioPauseIcon = ({ size = 14, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <rect x="6" y="4.5" width="4" height="15" rx="1"/>
    <rect x="14" y="4.5" width="4" height="15" rx="1"/>
  </svg>
);

export const StopIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <rect x="6" y="6" width="12" height="12" rx="2.5"/>
  </svg>
);

export const PaperclipIcon = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 11.5l-7.8 7.8a5 5 0 01-7.1-7.1l8.5-8.5a3.3 3.3 0 014.7 4.7l-8.5 8.5a1.7 1.7 0 01-2.4-2.4l7.8-7.8"/>
  </svg>
);

export const DatabaseIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 5V19A9 3 0 0 0 21 19V5" />
    <path d="M3 12A9 3 0 0 0 21 12" />
  </svg>
);

export const HistoryIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M12 7v5l4 2" />
  </svg>
);

export const ProfileIcon = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="4.5"/>
    <circle cx="12" cy="10" r="3"/>
    <path d="M7 18a5 5 0 0110 0"/>
  </svg>
);

export const JournalIcon = ({ size = 22, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 4.5A1.5 1.5 0 016.5 3H19v16H6.5A1.5 1.5 0 005 20.5z"/>
    <path d="M5 20.5A1.5 1.5 0 006.5 22H19v-3M9 7.5h6M9 11h4"/>
  </svg>
);

export const SmileIcon = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="9"/>
    <path d="M8.5 14.5a4.5 4.5 0 007 0"/>
    <circle cx="9" cy="10" r=".9" fill="currentColor"/>
    <circle cx="15" cy="10" r=".9" fill="currentColor"/>
  </svg>
);

export const ArchetypeIcon = ({ label, size = 24, className = '' }) => {
  const strokeWidth = size > 24 ? 1.7 : 2;
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
      aria-hidden="true"
    >
      {label === 'bleeding' && (
        <>
          <path d="M12 2.8l8 3v6.1c0 4.7-3.4 8.6-8 9.6-4.6-1-8-4.9-8-9.6V5.8z" />
          <path d="M12 8.2v7.2M8.4 11.8h7.2" />
        </>
      )}
      {label === 'slipping' && (
        <>
          <rect x="8.5" y="2.8" width="7" height="6" rx="1.2" />
          <rect x="2.8" y="15.2" width="7" height="6" rx="1.2" />
          <rect x="14.2" y="15.2" width="7" height="6" rx="1.2" />
          <path d="M12 8.8v3.2M6.3 15.2V12h11.4v3.2" />
        </>
      )}
      {label === 'stable' && (
        <>
          <path d="M3 20h18" />
          <rect x="4.5" y="13" width="3.6" height="7" rx=".8" />
          <rect x="10.2" y="9" width="3.6" height="11" rx=".8" />
          <rect x="15.9" y="4.5" width="3.6" height="15.5" rx=".8" />
        </>
      )}
      {label === 'leading' && (
        <path d="M13.5 2.5L4.5 13.5h6.5l-1 8 9-11h-6.5z" />
      )}
    </svg>
  );
};



