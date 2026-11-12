import type { Metadata } from 'next';
import StaffWorkspace from '@/features/staff/StaffWorkspace';
import StaffGate from '@/features/staff/StaffGate';

export const metadata: Metadata = { title: 'Nhân viên | BrewLite' };

export default function StaffPage() {
    return (
        <StaffGate>
            <StaffWorkspace />
        </StaffGate>
    );
}
