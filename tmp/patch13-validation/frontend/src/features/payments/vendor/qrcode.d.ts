declare function qrcode(type: number, level: 'L'|'M'|'Q'|'H'): {
 addData(data: string): void; make(): void; getModuleCount(): number; isDark(row: number, col: number): boolean;
};
export default qrcode;
