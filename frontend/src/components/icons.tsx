// Bộ icon nét mảnh dùng chung, vẽ bằng SVG để không phụ thuộc thư viện ngoài.
type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={className}
        >
            {children}
        </svg>
    );
}

export const IconCup = (p: IconProps) => (
    <Svg {...p}>
        <path d="M5 8h12v6a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8Z" />
        <path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17" />
        <path d="M9 3.5c0 1 .8 1.2.8 2.2M13 3.5c0 1 .8 1.2.8 2.2" />
    </Svg>
);

export const IconCart = (p: IconProps) => (
    <Svg {...p}>
        <path d="M3.5 4.5h2l2 10.5h9.5l1.8-7.5H6.4" />
        <circle cx="9.5" cy="19" r="1.3" />
        <circle cx="16.5" cy="19" r="1.3" />
    </Svg>
);

export const IconReceipt = (p: IconProps) => (
    <Svg {...p}>
        <path d="M6 3.5h12v17l-2.4-1.6-1.8 1.6-1.8-1.6-1.8 1.6-1.8-1.6L6 20.5v-17Z" />
        <path d="M9.5 8.5h5M9.5 12h5" />
    </Svg>
);

export const IconStar = ({ className }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
        <path d="m12 3.2 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7L12 3.2Z" />
    </svg>
);

export const IconChevronLeft = (p: IconProps) => (
    <Svg {...p}>
        <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
    </Svg>
);

export const IconPlus = (p: IconProps) => (
    <Svg {...p}>
        <path d="M12 5.5v13M5.5 12h13" />
    </Svg>
);

export const IconMinus = (p: IconProps) => (
    <Svg {...p}>
        <path d="M5.5 12h13" />
    </Svg>
);

export const IconTrash = (p: IconProps) => (
    <Svg {...p}>
        <path d="M4.5 7h15M9.5 7V4.8h5V7M7 7l.8 12h8.4L17 7M10.5 11v5M13.5 11v5" />
    </Svg>
);

export const IconCheck = (p: IconProps) => (
    <Svg {...p}>
        <path d="m5.5 12.5 4.2 4.2 8.8-9.2" />
    </Svg>
);

export const IconWallet = (p: IconProps) => (
    <Svg {...p}>
        <path d="M4.5 7.5A2 2 0 0 1 6.5 5.5h10.5v3" />
        <path d="M4.5 7.5v9a2 2 0 0 0 2 2h12v-9h-12a2 2 0 0 1-2-2Z" />
        <circle cx="15.5" cy="14" r="1" />
    </Svg>
);

export const IconCard = (p: IconProps) => (
    <Svg {...p}>
        <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
        <path d="M3.5 10h17M7 14.5h3" />
    </Svg>
);

export const IconLogout = (p: IconProps) => (
    <Svg {...p}>
        <path d="M10 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H10" />
        <path d="M15 8l4 4-4 4M19 12H9.5" />
    </Svg>
);

export const IconRefresh = (p: IconProps) => (
    <Svg {...p}>
        <path d="M19 6.5V11h-4.5" />
        <path d="M19 11a7 7 0 1 0-1.6 5" />
    </Svg>
);

export const IconEye = (p: IconProps) => (
    <Svg {...p}>
        <path d="M2.8 12S6 6.5 12 6.5 21.2 12 21.2 12 18 17.5 12 17.5 2.8 12 2.8 12Z" />
        <circle cx="12" cy="12" r="2.6" />
    </Svg>
);

export const IconEyeOff = (p: IconProps) => (
    <Svg {...p}>
        <path d="M4 4l16 16" />
        <path d="M9.9 6.7A9 9 0 0 1 12 6.5c6 0 9.2 5.5 9.2 5.5a15 15 0 0 1-3 3.6M6.5 8.3A14.6 14.6 0 0 0 2.8 12S6 17.5 12 17.500a8.8 8.8 0 0 0 3.3-.6" />
        <path d="M10 10.200a2.6 2.6 0 0 0 3.6 3.6" />
    </Svg>
);

export const IconTag = (p: IconProps) => (
    <Svg {...p}>
        <path d="M3.5 12.200V4.500h7.700l9.3 9.3-7.7 7.7-9.3-9.300Z" />
        <circle cx="8" cy="9" r="1.2" />
    </Svg>
);
