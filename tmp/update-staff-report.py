from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1];report=root/'Assignment-report'
b=root/'proposed-fixes/19-report-staff-realtime/before/Assignment_report.tex'
if not b.exists():b.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(report/'Assignment_report.tex',b)
p=report/'Assignment_report.tex';s=p.read_text(encoding='utf-8')
s=s.replace('\\subsection{Quy tắc tính giá, giảm giá và điểm thưởng}', '\\input{sections/staff-design.tex}\n\n\\subsection{Quy tắc tính giá, giảm giá và điểm thưởng}')
s=s.replace('\\subsection{Đóng gói và triển khai}', '\\input{sections/staff-implementation.tex}\n\n\\subsection{Đóng gói và triển khai}')
s=s.replace('\\subsection{Kiểm thử chức năng thủ công}', '\\input{sections/staff-testing.tex}\n\n\\subsection{Kiểm thử chức năng thủ công}')
p.write_text(s,encoding='utf-8')
out=report/'assets/staff';out.mkdir(parents=True,exist_ok=True)
shutil.copy2(root/'docs/diagrams/staff-realtime.png',out/'staff-realtime.png')
print('Staff and realtime report sections added; source untouched.')
