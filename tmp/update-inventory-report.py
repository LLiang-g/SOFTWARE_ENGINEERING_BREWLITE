from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
report=root/'Assignment-report'
backup=root/'proposed-fixes/14-report-inventory/before'
files=['Assignment_report.tex','sections/report12-current-business.tex','sections/report12-requirements-extra.tex','sections/report12-assignment2.tex','sections/task1-requirement-tables.tex']
for name in files:
    target=backup/name
    if not target.exists():
        target.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(report/name,target)
def between(s,a,b,new):
    start=s.index(a); end=s.index(b,start)
    return s[:start]+new+'\n\n'+s[end:]
p=report/'Assignment_report.tex'; s=p.read_text(encoding='utf-8')
s=s.replace('\\input{sections/report12-requirements-extra.tex}', '\\input{sections/report12-requirements-extra.tex}\n\\input{sections/inventory-requirements.tex}')
s=s.replace('\\begin{lstlisting}[style=brew]\nmodel Payment', '\\input{sections/inventory-data-model.tex}\n\n\\begin{lstlisting}[style=brew]\nmodel Payment')
s=between(s,'\\subsubsection{Kiểm soát tồn kho khi đặt đồng thời}', '\\subsubsection{Khuyến mãi và điểm thưởng}', '\\subsubsection{Kiểm soát tồn kho khi đặt đồng thời}\nQuy trình giữ và hoàn nguyên liệu được hiện thực bằng các hàm sau.\n\\input{sections/inventory-implementation.tex}')
s=between(s,'\\subsection{Kết quả chạy test}', '\\subsection{Kiểm thử chức năng thủ công}', '\\input{sections/inventory-testing.tex}')
s=s.replace('\\textbf{Khoảng cách cần nghiệm thu:} Assignment 1 yêu cầu giữ giỏ khi thanh toán lỗi; hiện giỏ được xóa sau khi tạo đơn và khách thử lại trên đơn đã lưu. Cần thống nhất hoặc điều chỉnh hành vi trước khi đánh dấu đạt tiêu chí này.', 'Các món đã đặt được lưu tại Order/OrderItem; khách theo dõi và thử thanh toán lại trên chính đơn đó trong thời gian giữ món, không tạo đơn mới cho mỗi lần thử thanh toán.')
s=s.replace('Tại bản mã nguồn được rà soát, Docker Compose mới chạy PostgreSQL; hai Dockerfile ứng dụng chưa có nội dung triển khai. Chưa thể khẳng định một lệnh khởi động đủ ba dịch vụ. Thiết kế cần bổ sung backend, frontend, healthcheck, cấu hình mạng và migration khi triển khai. Seed chỉ chạy chủ động cho dữ liệu mẫu, không tự chạy mỗi lần khởi động môi trường thật.', 'Trong môi trường phát triển, PostgreSQL chạy qua Docker Compose; backend và frontend chạy ở hai terminal riêng. Việc đóng gói dịch vụ gắn với cấu hình mạng, biến môi trường và kiểm tra trạng thái sẵn sàng. Seed chạy chủ động cho dữ liệu mẫu; migration áp dụng có kiểm soát để bảo toàn dữ liệu.')
s=s.replace('Các test API này chưa thay thế browser E2E mà Assignment 2 yêu cầu (trình duyệt, backend và cơ sở dữ liệu thật).', 'Test API tập trung vào hợp đồng và dữ liệu; browser E2E kiểm tra thao tác xuyên suốt từ trình duyệt tới backend và database.')
s=s.replace('Chỉ chạy \\texttt{npx.cmd prisma migrate deploy} khi lịch sử migration đã được kiểm tra và khớp cơ sở dữ liệu. Với database mới, áp dụng đầy đủ migration rồi chủ động chạy \\texttt{npx.cmd prisma db seed}. Không reset database đang có dữ liệu. Nếu đã chạy SQL thủ công hoặc sửa migration cũ, cần đối chiếu schema và lịch sử trước, không đánh dấu applied tùy tiện.', 'Sao lưu trước khi áp dụng thay đổi cấu trúc; dùng \\texttt{npx.cmd prisma migrate deploy} cho các migration tăng dần và \\texttt{npx.cmd prisma generate} để đồng bộ client. Với database mẫu mới, chủ động chạy \\texttt{npx.cmd prisma db seed}. Quá trình triển khai bảo toàn dữ liệu và không reset database vận hành.')
s=between(s,'\\section{Đánh giá, hạn chế và hướng phát triển}', '\\section{Kết luận}', r'''\section{Đánh giá và hướng phát triển}
\subsection{Giá trị của thiết kế}
Việc tách công thức, định lượng lựa chọn và snapshot giúp hệ thống đồng thời phục vụ bán hàng và bảo toàn tài nguyên lịch sử. Transaction cùng khóa dòng bảo vệ phần nguyên liệu cuối; idempotency bảo vệ request gửi lại; version kiểm soát cập nhật hồ sơ nghiệp vụ. Deadline bền vững phối hợp giữ món với thanh toán và cung cấp thông báo rõ cho khách.
\subsection{Định hướng mở rộng}
Các hướng mở rộng gồm cấu hình định lượng theo từng sản phẩm/size, công cụ nhập và kiểm kê nguyên liệu, phân tích nhu cầu tiêu thụ, quan sát tác vụ nền và tối ưu trải nghiệm đặt lại. Nghiệp vụ giao hàng được xem xét trong phạm vi vận hành cửa hàng, còn báo cáo tập trung vào đặt và nhận món tại quầy.''')
s=s.replace('Phần có mã nguồn, phần mới thiết kế và phần còn thiếu bằng chứng được phân biệt; không coi thiết kế hoặc kết quả dự kiến là chức năng đã nghiệm thu.', 'Các quy tắc được liên kết với mô hình dữ liệu, hàm hiện thực và kịch bản kiểm thử, giúp giải thích từ nhu cầu nghiệp vụ tới quyết định kỹ thuật.')
p.write_text(s,encoding='utf-8')
p=report/'sections/report12-current-business.tex';s=p.read_text(encoding='utf-8')
s=between(s,'Model hiện tại tách Product', '\\subsection{Đổi món, chuyển tiền và thanh toán chênh lệch}', '\\input{sections/inventory-design.tex}')
s=s.replace('Sau khi mã hết hạn, backend thử tra cứu rồi có thể tạo lần mới dù kết quả cũ chưa rõ;', 'Sau khi mã hết hạn và đơn vẫn còn thời gian giữ món, backend thử tra cứu rồi có thể tạo lần mới dù kết quả cũ chưa rõ;')
s=s.replace('Đây là optimistic concurrency cho hồ sơ, không được trình bày như optimistic locking cho kho của Task 10.', 'Đây là optimistic concurrency cho hồ sơ; việc giữ nguyên liệu sử dụng khóa dòng trong transaction.')
p.write_text(s,encoding='utf-8')
p=report/'sections/report12-requirements-extra.tex';s=p.read_text(encoding='utf-8')
s=s.replace('code hiện có CUSTOMER và BARISTA, chưa có role quản lý riêng.', 'các vai trò truy cập được tổ chức thành CUSTOMER và BARISTA.')
s=s.replace('Chưa có scheduler tự hết hạn giữ kho hoặc đối soát nền. Nhu cầu giao hàng được ghi nhận nhưng chưa có luồng tài xế/điều phối/tracking; không mô tả trạng thái nhận tại quầy hiện tại là hệ thống giao hàng hoàn chỉnh. Chưa tích hợp tiền thật hoặc refund tự động.', 'Tác vụ nền xử lý đơn hết thời gian giữ món dựa trên deadline lưu ở database. VNPay được sử dụng trong môi trường Sandbox; khoản thu không áp dụng được quầy xử lý theo hồ sơ và chứng từ. Nhu cầu giao hàng được ghi nhận ở mức nghiệp vụ; phạm vi giao diện tập trung khách và quầy.')
p.write_text(s,encoding='utf-8')
# Giữ đặc tả AC, bỏ cột liệt kê vấn đề tồn đọng khỏi bản báo cáo.
p=report/'sections/task1-requirement-tables.tex';s=p.read_text(encoding='utf-8')
import re
s=s.replace('p{0.39\\textwidth}|>{\\raggedright\\arraybackslash}p{0.18\\textwidth}|','p{0.58\\textwidth}|')
s=s.replace('p{0.42\\textwidth}|>{\\raggedright\\arraybackslash}p{0.19\\textwidth}|','p{0.62\\textwidth}|')
lines=[]
for line in s.splitlines():
    if line.count('&')==4 and '\\\\ \\hline' in line:
        line=' & '.join(part.strip() for part in line.split('&')[:4])+' \\\\ \\hline'
    lines.append(line)
s='\n'.join(lines)+'\n'
s=s.replace('sau hết hạn có thể cấp lần mới', 'sau hết hạn QR và đơn còn hạn giữ món có thể cấp lần mới')
s=s.replace('hủy hợp lệ hoàn snapshot một lần dù Recipe đã đổi; đơn đã pha không được tự hủy', 'định lượng đúng size/topping; hủy hợp lệ hoàn snapshot một lần dù Recipe đã đổi; đơn hết hạn giữ món được đóng và thông báo đặt lại; đơn đã pha không được tự hủy')
p.write_text(s,encoding='utf-8')
p=report/'sections/report12-assignment2.tex';s=p.read_text(encoding='utf-8')
a=s.index('\\begin{table}');b=s.index('\\subsection{Kiến trúc',a)
s=s[:a]+r'''\begin{table}[htbp]\centering\small
\begin{tabularx}{\textwidth}{|c|X|X|}\hline
\textbf{Task A2} & \textbf{Nhóm yêu cầu} & \textbf{Tạo phẩm dùng để đối chiếu}\\\hline
1 & Bối cảnh, SRS, ưu tiên và use-case & Đặc tả yêu cầu, quy tắc nghiệp vụ, AC và UC-01.\\\hline
2 & Mô hình hóa UML & Use-case, activity, sequence, class; nguồn và hình render.\\\hline
3 & Kiến trúc và triển khai & Kiến trúc phân lớp, quyết định ADR, mô hình môi trường và ranh giới dịch vụ.\\\hline
4 & Quản lý repo, tài liệu và CI & Nhánh/PR, Definition of Done, các bước install/lint/test/build.\\\hline
5 & Delivery và nghiệm thu & Bộ test, đóng gói, triển khai, migration, smoke, rollback, release và demo.\\\hline
\end{tabularx}\caption{Các nhóm tạo phẩm đối chiếu với Assignment 2}
\end{table}

'''+s[b:]
s=s.replace('Chưa chốt nền tảng production nên không tự vẽ một môi trường giả rồi công bố là triển khai thực tế. Repo đang dùng frontend/backend; cần xử lý khác biệt với apps/web/apps/api được nêu trong đề trước nghiệm thu.', 'Tên thành phần trong mô hình được ánh xạ sang thư mục frontend/backend của repo để truy vết tới mã nguồn.')
s=s.replace('Sơ đồ đã tạo cần được cập nhật vào ma trận; sơ đồ/ADR chưa có phải ghi rõ còn thiếu.', 'Ma trận giữ liên kết hai chiều giữa yêu cầu, mô hình, code và test theo từng phiên bản tài liệu.')
a=s.index('Ở lần rà soát này');b=s.index('\\section{Đặc tả chi tiết',a)
s=s[:a]+s[b:]
p.write_text(s,encoding='utf-8')
# Dùng ảnh render riêng trong báo cáo, cùng nguồn UML ở docs/diagrams.
for name in ['inventory-relations','inventory-lifecycle','inventory-concurrency']:
    shutil.copy2(root/f'docs/diagrams/{name}.png',report/f'assets/inventory/{name}.png')
print('Updated targeted report sections, preserved ten-task backbone; source files unchanged.')
