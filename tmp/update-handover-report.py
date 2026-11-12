from pathlib import Path
import re, shutil
r=Path(__file__).resolve().parents[1]; d=r/'Assignment-report'; backup=r/'proposed-fixes/20-report-handover-catalog/before'
files=['Assignment_report.tex','sections/report12-requirements-extra.tex','sections/task1-requirement-tables.tex','sections/task1-usecase-tables.tex','sections/report12-uml.tex']
for f in files:
 p=backup/f; p.parent.mkdir(parents=True,exist_ok=True)
 if not p.exists(): shutil.copy2(d/f,p)
p=d/files[0]; s=p.read_text(encoding='utf-8')
a=s.index('\\subsection{Yêu cầu chức năng}',s.index('\\section{Phân tích yêu cầu}')); b=s.index('\\input{sections/report12-requirements-extra.tex}',a)
s=s[:a]+r'''\subsection{Yêu cầu chức năng và tiêu chí chấp nhận}
Các yêu cầu được ưu tiên theo MoSCoW: Must là bắt buộc, Should là ưu tiên cao, Could là tùy chọn; Won't nằm ngoài phạm vi bàn giao. Tiêu chí dưới đây là căn cứ nghiệm thu, kết quả kiểm chứng được trình bày riêng ở phần kiểm thử.
\input{sections/task1-requirement-tables.tex}
\subsection{Use-case đặt và thanh toán đơn}
\input{sections/task1-usecase-tables.tex}

'''+s[b:]
a=s.index('\\subsection{Menu, chi tiết sản phẩm và giỏ hàng}'); b=s.index('\\subsection{Xác thực}',a)
s=s[:a]+'\\subsection{Menu, chi tiết sản phẩm và giỏ hàng}\n\\input{sections/catalog-cart-implementation.tex}\n\n'+s[b:]
a=s.index('\\subsection{Thiết kế giao diện}'); b=s.index('\\newpage',a)
s=s[:a]+r'''\subsection{Thiết kế giao diện}
\label{sec:catalog-ui}
Menu ưu tiên tên món, giá và hình ảnh; trang chi tiết gom size, topping và số lượng trước thao tác thêm giỏ. Giỏ hàng cho sửa lựa chọn và xem tổng trước khi tạo đơn. Các màn hình thanh toán, đổi món và quầy được minh họa tại phần nghiệp vụ tương ứng.
\begin{figure}[htbp]\centering
\includegraphics[width=.48\linewidth,height=.37\textheight,keepaspectratio]{assets/catalog-cart/ui-menu.png}\hfill
\includegraphics[width=.48\linewidth,height=.37\textheight,keepaspectratio]{assets/catalog-cart/ui-detail.png}
\caption{Menu và chi tiết món trên môi trường local, dùng API danh mục}
\vspace{3mm}
\includegraphics[width=.83\linewidth,height=.30\textheight,keepaspectratio]{assets/catalog-cart/ui-cart.png}
\caption{Giỏ hàng trước khi gửi đặt đơn; thao tác thêm món chỉ lưu ở trình duyệt}
\end{figure}

'''+s[b:]
s=s.replace('\\subsection{Kiểm thử chức năng thủ công}','\\input{sections/catalog-cart-testing.tex}\n\n\\subsection{Kiểm thử chức năng thủ công}')
s=s.replace('\\appendix\n\\input{sections/report12-assignment2.tex}\n','')
replacements={
'Bài tập lớn môn Công nghệ Phần mềm':'Báo cáo bàn giao BrewLite',
'{\\Large Bài tập lớn}':'{\\Large Báo cáo bàn giao sản phẩm}',
'Tầm nhìn sản phẩm (Product Vision) của đề bài là:':'Tầm nhìn sản phẩm (Product Vision) là:',
'Đề bài chia công việc thành 10 task, mỗi task hoàn thành được 1 điểm, tổng 10 điểm.':'Product Backlog gồm 10 hạng mục phát triển, mỗi hạng mục có tiêu chí chấp nhận để kiểm tra kết quả bàn giao.',
'\\textbf{Task}':'\\textbf{Hạng mục}',
'Product Backlog theo đề bài':'Product Backlog của BrewLite',
'Kế hoạch gợi ý của đề chia 3 Sprint theo số thứ tự task. ':'',
'Một task được tính điểm khi thỏa các điều kiện sau:':'Một hạng mục được xem là hoàn thành khi thỏa các điều kiện sau:',
'đề bài chưa nêu rõ':'cần được thống nhất sớm',
'để đúng với đề và để hủy đơn có ý nghĩa':'để tách tạo đơn khỏi xác nhận thanh toán và hỗ trợ hủy đơn chưa trả',
'Các mức phụ thu, mức giảm và tỷ lệ điểm là do nhóm tự thống nhất vì đề bài chưa quy định.':'Các mức phụ thu, mức giảm và tỷ lệ điểm là chính sách cấu hình của cửa hàng.',
'Nghiệp vụ nâng cao (Task 10)':'Toàn vẹn đơn hàng, thanh toán và tồn kho',
'Test chứng minh yêu cầu chấm của Task 10':'Kiểm thử các quy tắc toàn vẹn nghiệp vụ',
'Ánh xạ giữa yêu cầu của đề và các test':'Ánh xạ giữa quy tắc nghiệp vụ và các test',
'Báo cáo giữ Product Backlog 10 task của Assignment 1, đồng thời bổ sung đặc tả và kế hoạch minh chứng cho Assignment 2.':'Báo cáo trình bày yêu cầu sản phẩm, thiết kế, hiện thực, kiểm thử và hướng dẫn triển khai để phục vụ bàn giao và bảo trì.',
}
for x,y in replacements.items(): s=s.replace(x,y)
s=re.sub(r'\\chen\{[^{}]*\}', '',s)
s=s.replace('Bài tập lớn yêu cầu','Sản phẩm cần').replace('Công nghệ bắt buộc','Công nghệ được lựa chọn')
p.write_text(s,encoding='utf-8')
p=d/files[1]; s=p.read_text(encoding='utf-8'); a=s.index('\\subsection{Giả định'); b=s.index('\\subsection{Đặc tả UC-01'); c=s.index('\\begin{figure}',b)
s=s[a:b]+'\\subsection{Sơ đồ use-case}\nHai sơ đồ tóm tắt phạm vi chức năng và tương tác trong luồng đặt, thanh toán đơn.\n'+s[c:]
s=s.replace('Tài liệu bối cảnh đầy đủ có bảng stakeholder, kỳ vọng, phạm vi, giả định, ràng buộc và rủi ro tại \\texttt{context-and-scope.md}.','')
p.write_text(s,encoding='utf-8')
p=d/files[2]; s=p.read_text(encoding='utf-8'); s=re.sub(r' --- đề Task [^&\n]+', '',s).replace(' --- mở rộng','').replace('Yêu cầu / nguồn','Yêu cầu').replace('FR và tiêu chí chấp nhận của baseline 1.0','Yêu cầu chức năng và tiêu chí chấp nhận').replace('lần nộp','bàn giao').replace('theo BR-03/13','theo chính sách giảm giá và tích điểm').replace('đúng BR-21','đúng máy trạng thái đơn hàng'); p.write_text(s,encoding='utf-8')
p=d/files[3]; s=p.read_text(encoding='utf-8'); s=re.sub(r' ST-\d+','',s).replace('BR-01--13, BR-18, BR-21','Giá do backend chốt; giữ/hoàn theo snapshot; thanh toán xác nhận một lần; chỉ chuyển trạng thái hợp lệ').replace('Kiểm tra BR-06','Kiểm tra đơn chưa thanh toán và còn được hủy').replace('theo BR-06','theo điều kiện hủy đơn chưa thanh toán').replace('và UC-10 xử lý hoàn thủ công','để quầy xử lý hoàn khoản thu dư').replace('Transaction khóa Order, xác nhận một lần, ghi Payment, PAID và điểm; Return không ghi PAID','Return chuyển về giao diện; trình duyệt đọc trạng thái backend. IPN/QueryDr mới xác nhận Payment, PAID và điểm trong transaction'); p.write_text(s,encoding='utf-8')
p=d/files[4]; s=p.read_text(encoding='utf-8').replace('Mô hình UML bổ sung theo Assignment 2','Mô hình hoạt động, tương tác và miền dữ liệu').replace('Voucher hiện thực khái niệm Promotion của đề','Voucher biểu diễn chính sách mã giảm giá'); p.write_text(s,encoding='utf-8')
print('Updated handover report and merged requirements/use-case.')
