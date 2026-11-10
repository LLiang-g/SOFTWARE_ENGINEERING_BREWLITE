import Link from 'next/link';
import { IconChevronLeft } from './icons';

// Liên kết quay lại ở đầu trang con, vùng bấm đủ lớn cho ngón tay.
export default function BackLink({ href, label }: { href: string; label: string }) {
    return (
        <Link
            href={href}
            className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full pr-3 pl-1 text-sm font-medium text-muted hover:text-espresso"
        >
            <IconChevronLeft className="h-5 w-5" />
            {label}
        </Link>
    );
}
