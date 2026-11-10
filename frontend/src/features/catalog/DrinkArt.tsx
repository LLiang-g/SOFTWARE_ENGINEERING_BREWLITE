// Hình minh họa ly đồ uống vẽ bằng SVG, dùng khi sản phẩm chưa có ảnh thật.
export type DrinkKind = 'milk-coffee' | 'americano' | 'cappuccino' | 'tea' | 'cup';

// Màu nền nhạt đi kèm từng loại đồ uống.
export const DRINK_TINT: Record<DrinkKind, string> = {
    'milk-coffee': '#f1e2cc',
    americano: '#e4dfd7',
    cappuccino: '#eddfd3',
    tea: '#f8ddcf',
    cup: '#ece6dc',
};

export function drinkKindFor(name: string): DrinkKind {
    const n = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd');
    if (n.includes('ca phe sua') || n.includes('bac xiu')) return 'milk-coffee';
    if (n.includes('americano') || n.includes('ca phe den') || n.includes('espresso')) return 'americano';
    if (n.includes('cappuccino') || n.includes('latte')) return 'cappuccino';
    if (/\btra\b/.test(n)) return 'tea';
    return 'cup';
}

// Ly thủy tinh hình thang: mép trái/phải ở độ cao y.
const GLASS_PATH = 'M32 30H88L80.5 130Q80 134 76 134H44Q40 134 39.5 130Z';
function edge(y: number): [number, number] {
    const dx = (y - 30) * 0.075;
    return [32 + dx, 88 - dx];
}
function liquid(topY: number, bottomY = 131): string {
    const [l1, r1] = edge(topY);
    const [l2, r2] = edge(bottomY);
    return `M${l1} ${topY}H${r1}L${r2} ${bottomY}H${l2}Z`;
}

function Ice({ x, y, r = 0 }: { x: number; y: number; r?: number }) {
    return (
        <rect
            x={x}
            y={y}
            width={15}
            height={15}
            rx={3.5}
            transform={`rotate(${r} ${x + 7.5} ${y + 7.5})`}
            fill="#fff"
            fillOpacity={0.38}
            stroke="#fff"
            strokeOpacity={0.55}
        />
    );
}

function Shadow() {
    return <ellipse cx={60} cy={142} rx={34} ry={4} fill="#2b1a12" opacity={0.12} />;
}

function Glass() {
    return (
        <>
            <path d={GLASS_PATH} fill="#fff" fillOpacity={0.55} />
        </>
    );
}

function GlassRim() {
    return (
        <>
            <path d={GLASS_PATH} fill="none" stroke="#fff" strokeWidth={2} />
            <rect x={30} y={28} width={60} height={4} rx={2} fill="#fff" />
        </>
    );
}

function Straw({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
    return <path d={`M${x1} ${y1}L${x2} ${y2}`} stroke="#e3a33b" strokeWidth={5} strokeLinecap="round" />;
}

export default function DrinkArt({ kind, className }: { kind: DrinkKind; className?: string }) {
    return (
        <svg viewBox="0 0 120 150" aria-hidden="true" className={className}>
            <Shadow />
            {kind === 'americano' && (
                <>
                    <Glass />
                    <path d={liquid(50)} fill="#2b1a12" />
                    <rect x={40} y={56} width={4} height={62} rx={2} fill="#fff" opacity={0.16} />
                    <Straw x1={76} y1={10} x2={67} y2={120} />
                    <Ice x={42} y={52} r={-12} />
                    <Ice x={62} y={64} r={14} />
                    <Ice x={46} y={86} r={8} />
                    <GlassRim />
                </>
            )}
            {kind === 'milk-coffee' && (
                <>
                    <Glass />
                    <path d={liquid(50, 96)} fill="#7a4a2b" />
                    <path d={liquid(96)} fill="#f8ebd5" />
                    <path d="M37.5 96H82.5" stroke="#fff" strokeOpacity={0.5} strokeWidth={1.5} />
                    <rect x={40} y={56} width={4} height={62} rx={2} fill="#fff" opacity={0.2} />
                    <Straw x1={76} y1={10} x2={66} y2={118} />
                    <Ice x={43} y={52} r={10} />
                    <Ice x={62} y={60} r={-10} />
                    <Ice x={52} y={78} r={16} />
                    <GlassRim />
                </>
            )}
            {kind === 'tea' && (
                <>
                    <Glass />
                    <path d={liquid(48, 92)} fill="#f2a07b" />
                    <path d={liquid(92)} fill="#f7be9c" />
                    <circle cx={54} cy={72} r={11} fill="#fbd2b0" stroke="#e98f63" strokeWidth={2} />
                    <path d="M54 72 54 61M54 72l9.5-5.500M54 72l9.5 5.5" stroke="#e98f63" strokeWidth={1.5} />
                    <Straw x1={77} y1={12} x2={68} y2={122} />
                    <Ice x={62} y={86} r={12} />
                    <Ice x={42} y={96} r={-8} />
                    <GlassRim />
                    <ellipse cx={46} cy={26} rx={9} ry={4.5} transform="rotate(-28 46 26)" fill="#2e7d5b" />
                    <ellipse cx={57} cy={24} rx={9} ry={4.5} transform="rotate(18 57 24)" fill="#3b9a73" />
                </>
            )}
            {kind === 'cappuccino' && (
                <>
                    <ellipse cx={60} cy={128} rx={46} ry={8} fill="#fff" />
                    <ellipse cx={60} cy={126} rx={34} ry={4.5} fill="#e9e3d8" />
                    <path d="M92 78q20 0 16 18-3 13-19 11" fill="none" stroke="#fff" strokeWidth={7} strokeLinecap="round" />
                    <path d="M26 72H94Q94 116 60 122 26 116 26 72Z" fill="#fff" />
                    <ellipse cx={60} cy={72} rx={34} ry={9} fill="#fff" />
                    <ellipse cx={60} cy={72} rx={30} ry={7} fill="#8a5a3b" />
                    <ellipse cx={60} cy={71} rx={26} ry={5.5} fill="#f4e6d0" />
                    <path d="M60 74c-6-3-8-7-5-8.5 2-1 4 0 5 1.5 1-1.5 3-2.5 5-1.5 3 1.5 1 5.5-5 8.500Z" fill="#8a5a3b" />
                    <path d="M50 52c-3-4 3-6 0-10M62 52c-3-4 3-6 0-10M74 52c-3-4 3-6 0-10" stroke="#2b1a12" strokeOpacity={0.22} strokeWidth={3} strokeLinecap="round" fill="none" />
                </>
            )}
            {kind === 'cup' && (
                <>
                    <path d="M28 46H92L83 132Q82 136 78 136H42Q38 136 37 132Z" fill="#fff" />
                    <path d="M30.5 72H89.500L86.5 108H33.500Z" fill="#2b1a12" />
                    <circle cx={60} cy={90} r={7} fill="#e3a33b" />
                    <path d="M26 46Q26 28 42 28H78Q94 28 94 46Z" fill="#efe9de" />
                    <rect x={22} y={44} width={76} height={8} rx={4} fill="#e1d9cb" />
                    <path d="M60 18v10" stroke="#2b1a12" strokeOpacity={0.25} strokeWidth={4} strokeLinecap="round" />
                </>
            )}
        </svg>
    );
}
