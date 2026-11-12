from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1];report=root/'Assignment-report'
b=root/'proposed-fixes/18-report-promotions/before/Assignment_report.tex'
if not b.exists():b.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(report/'Assignment_report.tex',b)
p=report/'Assignment_report.tex';s=p.read_text(encoding='utf-8')
a=s.index('\\subsection{Quy tắc tính giá, giảm giá và điểm thưởng}')
q=s.index('Các mức phụ thu, mức giảm và tỷ lệ điểm',a);e=s.index('\n',q)
s=s[:e]+'\n\\input{sections/promotions-design.tex}'+s[e:]
a=s.index('\\subsubsection{Khuyến mãi và điểm thưởng}');b=s.index('\\input{sections/exchange-implementation.tex}',a)
s=s[:a]+'\\subsubsection{Khuyến mãi và điểm thưởng}\n\\input{sections/promotions-implementation.tex}\n\n'+s[b:]
s=s.replace('\\subsection{Kiểm thử chức năng thủ công}', '\\input{sections/promotions-testing.tex}\n\n\\subsection{Kiểm thử chức năng thủ công}')
p.write_text(s,encoding='utf-8')
print('Promotions and loyalty report sections added; source untouched.')
