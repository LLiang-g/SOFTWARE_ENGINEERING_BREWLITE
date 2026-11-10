import type { Metadata } from 'next';
import StaffBoard from '@/features/staff/StaffBoard';

export const metadata: Metadata = { title: 'Nhân viên | BrewLite' };

export default function StaffPage() {
    return <StaffBoard />;
}
