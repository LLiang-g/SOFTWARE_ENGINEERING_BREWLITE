from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
report=root/'Assignment-report'
backup=root/'proposed-fixes/15-report-vnpay/before'
for name in ['Assignment_report.tex','sections/report12-current-business.tex']:
 p=backup/name
 if not p.exists():p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(report/name,p)
p=report/'sections/report12-current-business.tex';s=p.read_text(encoding='utf-8')
a=s.index('Ngoài mock Ví/Thẻ');b=s.index('\\subsection{Giữ kho',a)
s=s[:a]+'\\input{sections/vnpay-design.tex}\n\n'+s[b:];p.write_text(s,encoding='utf-8')
p=report/'Assignment_report.tex';s=p.read_text(encoding='utf-8')
s=s.replace('\\subsection{Tạo đơn và thanh toán giả lập}', '\\subsection{Tạo đơn và tích hợp thanh toán}')
a=s.index('Cổng thanh toán giả lập (');b=s.index('\\subsection{Nghiệp vụ nâng cao',a)
s=s[:a]+'''Cổng giả lập dùng để kiểm tra luồng Ví/Thẻ có kiểm soát; khi bật VNPay, endpoint mock bị chặn để không bỏ qua cổng. Luồng VNPay tách quá trình khách thao tác ở cổng khỏi transaction ghi nhận kết quả tại backend.

\\input{sections/vnpay-implementation.tex}

'''+s[b:]
s=s.replace('\\subsection{Kiểm thử chức năng thủ công}', '\\input{sections/vnpay-testing.tex}\n\n\\subsection{Kiểm thử chức năng thủ công}')
pos=s.index('\\bibitem{NEST}')
s=s[:pos]+r'''\bibitem{VNPAYPAY}
VNPAY, \textit{Kết nối cổng thanh toán và API QueryDr},
\url{https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.html},
truy cập ngày 12/11/2026.

\bibitem{VNPAYFAQ}
VNPAY, \textit{Câu hỏi thường gặp về tham số và Return/IPN},
\url{https://sandbox.vnpayment.vn/apis/docs/faqs/},
truy cập ngày 12/11/2026.

'''+s[pos:]
p.write_text(s,encoding='utf-8')
out=report/'assets/vnpay';out.mkdir(parents=True,exist_ok=True)
shutil.copy2(root/'docs/diagrams/vnpay-sequence.png',out/'vnpay-sequence.png')
print('VNPay sections inserted; ten-task structure preserved.')
