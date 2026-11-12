from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1];report=root/'Assignment-report'
backup=root/'proposed-fixes/17-report-auth/before/Assignment_report.tex'
if not backup.exists():backup.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(report/'Assignment_report.tex',backup)
p=report/'Assignment_report.tex';s=p.read_text(encoding='utf-8')
s=s.replace('\\subsection{Máy trạng thái đơn hàng (Order State Machine)}', '\\input{sections/auth-design.tex}\n\n\\subsection{Máy trạng thái đơn hàng (Order State Machine)}')
a=s.index('Mật khẩu được băm bằng bcrypt trước khi lưu.');b=s.index('\\subsection{Tạo đơn và tích hợp thanh toán}',a)
s=s[:a]+'\\input{sections/auth-implementation.tex}\n\n'+s[b:]
s=s.replace('\\subsection{Kiểm thử chức năng thủ công}', '\\input{sections/auth-testing.tex}\n\n\\subsection{Kiểm thử chức năng thủ công}')
# Hình luồng đặt sau ma trận ở phần thiết kế API, không làm đổi số các subsection 4.4 trở đi.
p.write_text(s,encoding='utf-8')
q=report/'sections/auth-design.tex';t=q.read_text(encoding='utf-8')
if 'assets/auth/auth-sequence.png' not in t:
 t+='\n\\begin{figure}[htbp]\\centering\n\\includegraphics[width=\\linewidth,height=.54\\textheight,keepaspectratio]{assets/auth/auth-sequence.png}\n\\caption{Đăng nhập cấp token và chuỗi kiểm danh tính, vai trò, chủ đơn ở backend}\n\\end{figure}\n'
 q.write_text(t,encoding='utf-8')
out=report/'assets/auth';out.mkdir(parents=True,exist_ok=True)
shutil.copy2(root/'docs/diagrams/auth-sequence.png',out/'auth-sequence.png')
print('Updated auth report sections; source application unchanged.')
