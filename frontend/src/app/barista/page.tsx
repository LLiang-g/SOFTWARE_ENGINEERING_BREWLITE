import type { Metadata } from 'next';
import StaffBoard from '@/features/staff/StaffBoard';
import StaffGate from '@/features/staff/StaffGate';

export const metadata: Metadata = { title: 'Nhân viên | BrewLite' };

export default function StaffPage() {
    return (
        <StaffGate>
            <StaffBoard />
        </StaffGate>
    );
}
