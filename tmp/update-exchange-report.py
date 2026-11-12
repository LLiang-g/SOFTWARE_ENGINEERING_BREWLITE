from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]; report=root/'Assignment-report'
backup=root/'proposed-fixes/16-report-exchange/before'
for name in ['Assignment_report.tex','sections/report12-current-business.tex']:
 p=backup/name
 if not p.exists():p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(report/name,p)
p=report/'sections/report12-current-business.tex';s=p.read_text(encoding='utf-8')
a=s.index('Khách mở liên kết hỗ trợ nhỏ');b=s.index('\\subsection{Version',a)
s=s[:a]+'\\input{sections/exchange-design.tex}\n\n'+s[b:];p.write_text(s,encoding='utf-8')
p=report/'Assignment_report.tex';s=p.read_text(encoding='utf-8')
s=s.replace('\\subsection{Đóng gói và triển khai}', '\\input{sections/exchange-implementation.tex}\n\n\\subsection{Đóng gói và triển khai}')
s=s.replace('\\subsection{Kiểm thử chức năng thủ công}', '\\input{sections/exchange-testing.tex}\n\n\\subsection{Kiểm thử chức năng thủ công}')
p.write_text(s,encoding='utf-8')
out=report/'assets/exchange';out.mkdir(parents=True,exist_ok=True)
shutil.copy2(root/'docs/diagrams/exchange-sequence.png',out/'exchange-sequence.png')
for name in ['customer-cart-mobile.png','staff-exchange-desktop.png']:
 shutil.copy2(root/'proposed-fixes/08-exchange-workflow/screenshots'/name,out/name)
print('Exchange report sections inserted; application code unchanged.')
