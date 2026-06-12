# Quy tắc phát triển — Project Tracker Pro

## 1. Nguyên tắc chung
- Trước mỗi thay đổi, phân tích impact: có tăng Firestore reads/writes không? Có gây re-render không cần thiết không? Có rò rỉ listener không?
- Nâng cấp từng phần, không viết lại toàn bộ trừ khi thực sự cần.
- Không phá vỡ chức năng hiện tại.
- Viết code hoàn chỉnh, không để `// TODO` hay placeholder.

## 2. Firebase & Firestore
- Luôn dùng `where()`, `limit()`, `orderBy()` — không load cả collection rồi filter ở frontend.
- Chỉ dùng `onSnapshot()` cho dữ liệu thực sự cần realtime, còn lại dùng `getDoc()`/`getDocs()`.
- Luôn `unsubscribe` listener khi component unmount.
- Không để listener trùng lặp cho cùng 1 dữ liệu.
- Dùng `updateDoc()` với dot notation, không ghi đè toàn bộ document.
- Thực hiện cập nhật dữ liệu qua các ham handler có sẵn (`updateStepStatus`, `updateProject`...) để đảm bảo đúng kiểu dữ liệu, đồng bộ hóa đúng cách và hạn chế reads/writes dư thừa.
- Pagination với `limit()` + `startAfter()` cho danh sách dài.
- Cache dữ liệu ít thay đổi bằng React state, không fetch lại mỗi lần render.

## 3. React & Performance
- Kiểm tra dependency array của mọi `useEffect` trước khi viết.
- Không để fetch/query chạy trong render loop.
- Dùng `useMemo`/`useCallback` đúng chỗ, không lạm dụng.
- Debounce 300ms cho mọi search/filter input.
- Nén ảnh trước khi upload, giới hạn dung lượng file.

## 4. UI Components — Bắt buộc dùng UI Primitives
Tuyệt đối không sử dụng HTML input thuần khi hiển thị hoặc nhận dữ liệu đầu vào từ người dùng. Luôn dùng các component có sẵn trong `src/components/ui-primitives.tsx` để duy trì tính nhất quán về giao diện (khoảng cách gap, padding, phông chữ Inter/Mono, border radius, vòng focus ring và biểu tượng chỉ báo lưu/trực quan hóa dữ liệu):

| Thay vì sử dụng HTML | Bắt buộc sử dụng UI Primitives | Cách truyền Props chính |
|---|---|---|
| `<input type="text">` | `<EditableInput />` | `value: string`, `onSave: (val: string) => void`, `placeholder?: string`, `readOnly?: boolean` |
| `<input type="number">` | `<NumberInput />` | `value: number`, `onChange: (val: number) => void`, `placeholder?: string`, `readOnly?: boolean` |
| `<input type="date">` | `<CustomDatePicker />` | `value: string`, `onChange: (val: string) => void`, `readOnly?: boolean` |
| `<select>` hoặc Input tự do có gợi ý tìm kiếm | `<Combobox />` | `options: string[] \| {value, label}[]`, `value: string`, `onChange: (val: string) => void`, `placeholder?: string`, `displayCodeOnly?: boolean` |
| Input tiền tệ/đọc giá trị tài chính | `<CurrencyInput />` | `value: number`, `onChange: (val: number) => void`, `readOnly?: boolean` |

- **Bảo toàn layout khoa học:** Đảm bảo khoảng cách (`gap`, `padding`), phông chữ (chỉ chọn `font-sans` hoặc `font-mono` theo phong cách kỹ thuật), bo viền (`rounded`), hiệu ứng đường viền (`border`) trên mọi biểu mẫu và bảng dữ liệu phải đồng bộ 100% với hệ thống cũ.
- **Ràng buộc bề ngang & thu gọn nút:** Khi co giãn cột cho các loại đất chi tiết hoặc biểu mẫu tương tự, luôn sử dụng tỷ lệ cứng thích hợp (ví dụ: `w-20` cho ô Loại đất, `w-12` cho các ô số thửa/số hộ, `flex-1` cho địa bàn) để tránh đẩy lệch màn hình hoặc che mất các nút hành động (như nút Xoá dòng `<Trash2>`).

## 5. Bảo mật
- Không hardcode email, key, hoặc thông tin nhạy cảm trong code.
- Firestore rules phải phân quyền rõ ràng theo role, không dùng `allow read, write: if true`.
- Validate dữ liệu cả ở frontend lẫn Firestore rules.

## 6. UI/UX
- Giao diện hiện đại, responsive tốt trên cả desktop và mobile.
- Dashboard với KPI, tiến độ, biểu đồ trực quan.
- Hệ thống phân quyền rõ ràng: admin / editor / viewer.

## 7. Mục tiêu
App quản lý dự án nội bộ (~70 người dùng), hoạt động ổn định trong Firebase/Vercel free tier, chi phí tối thiểu, dễ dàng mở rộng và bảo trì lâu dài bởi bất kỳ AI hay Senior Engineer nào.

## 8. Anti-Slop Design & Taste (Taste Skill Integration - v2)
Để loại bỏ hoàn toàn các lỗi giao diện rập khuôn do AI tạo ra (AI slop, viền bóng mờ tím neon không đồng bộ, khoảng cách tùy tiện), bất cứ khi nào chỉnh sửa UI, AI phải tuân thủ nghiêm ngặt các quy tắc thẩm mỹ "đắt tiền" và tinh tế sau:

### 8.1 Thiết lập hệ thống Dials (Bộ ba biến điều hướng)
Mỗi component hoặc giao diện tạo ra phải được thẩm định qua 3 trục giá trị để giữ tính đồng bộ:
- **`DESIGN_VARIANCE: 6`** (Tránh bất đối xứng quá đà trên các giao diện biểu mẫu kỹ thuật; đề cao sự chuyên nghiệp và cân đối).
- **`MOTION_INTENSITY: 3`** (Chỉ sử dụng hover nhẹ nhàng, fade-in tinh tế thông qua Framer Motion, không dùng các hiệu ứng chuyển động lặp vô tận gây xao nhãng).
- **`VISUAL_DENSITY: 8`** (Dashboard nội bộ chuyên dụng cần lượng thông tin cao, tuy nhiên phải giữ khoảng cách thở tinh tế bằng padding và gap chuyên nghiệp, không nhồi nhét).

### 8.2 Quy chuẩn Typography (Tránh font sến và rác bố cục)
- **Cấm hoàn toàn Serif Display mặc định:** Chỉ dùng phông chữ Sans-serif hiển thị sắc nét (như Inter kết hợp JetBrains Mono cho dữ liệu kỹ thuật). Tuyệt đối cấm sử dụng `Fraunces` hoặc `Instrument Serif` làm mặc định - đây là dấu vết rõ rệt nhất của AI slop.
- **Clearance Descender cho chữ nghiêng:** Nếu đoạn văn bản hiển thị có chứa ký tự thụt như `y g j p q` kết hợp với viết nghiêng, không được đặt `leading-none` hay `leading-[1]` để tránh bị cắt chữ. Luôn sử dụng tối thiểu `leading-[1.1]` kèm padding dự phòng phù hợp.
- **Nhấn mạnh đồng chất:** Ví dụ khi muốn nhấn mạnh một từ giữa tiêu đề, hãy sử dụng **bold** hoặc *italic* của chính phông chữ Sans đó. Việc đột ngột chèn một từ Serif vào giữa dòng Sans là hành vi thiết kế nghiệp dư.

### 8.3 Chuẩn hóa màu sắc & "The Lila Rule"
- **Quy tắc Lila:** Tuyệt đối cấm sử dụng các nút sáng tím/xanh neon mờ, các dải gradient đa sắc vô nghĩa (AI-purple neon mesh) để trang trí cho giao diện công cụ nghiệp vụ nghiêm túc.
- **Khóa nhất quán màu sắc:** Toàn bộ trang web chỉ được dùng duy nhất 1 tông màu nhấn chủ đạo hoặc thứ cấp (ví dụ: Emerald để đồng hành cùng các trạng thái hoàn thành bền vững). Đã chọn tông màu nào thì phải khóa và dùng đồng nhất trên toàn giao diện, không được tự ý đổi sang xanh dương hay hồng đậm ở các phần dưới.
- **Palette Màu thay thế:** Tránh dùng các dải màu kem giấy cổ điển sến súa (`#f5f1ea`) cho các công cụ kỹ thuật. Thay vào đó, hãy gắn liền với lối phối sáng sang trọng (Cold Slate): các tông Zinc, Slate hoặc Stone thanh thoát, tối ưu độ tương phản văn bản để tăng điểm trải nghiệm người dùng.

### 8.4 Spacing & Negative Space chuyên nghiệp
- Tránh đặt padding cứng đều giống nhau cho mọi khối. Cấu trúc thị giác cần có nhịp điệu (rhythm): các card lớn cần khoảng đệm thông thoáng (`p-6` hoặc `p-8`), trong khi các hàng lồng danh sách cần độ thu gọn cao (`p-2` hoặc `py-1.5 px-3`).
- Dùng CSS Grid thay cho cách tính toán tỷ lệ Flex phần trăm thủ công (`px`, `w-[calc(...)]`). Luôn ưu tiên căn lề có cấu trúc vững vàng.  
- Không lạm dụng biểu tượng cảm xúc (emoji) trên các nhãn nút chính, thay thế bằng các SVG icon sang trọng từ thư viện Phosphor (hoặc Lucide tùy dự án) để tối ưu tính biểu thị nghiệp vụ.

## 9. Cấu trúc file & Phân tách Component
- File component không được vượt quá 500 dòng. Nếu vượt, tách thành sub-components trong thư mục con tương ứng.
- Các step phức tạp (Inventory, PlanDraft, AppraisalSubmit, Approval, Payment) đã được tách vào `src/components/steps/`. Khi thêm logic mới cho các bước này, chỉnh sửa đúng file tương ứng, không thêm vào `StepDetail.tsx` chính.
- Shared utilities và constants của step nằm trong `src/components/steps/stepUtils.ts`.
- Khi tạo component mới, luôn đặt vào đúng thư mục: `components/steps/` cho các bước, `components/` cho các component dùng chung.

## 10. Nghiệp vụ GPMB — Quy tắc validate số liệu
- Số liệu kiểm đếm (donePlots, doneHouseholds) không được vượt quá tổng chỉ tiêu (totalPlots, totalHouseholds).
- Số liệu trình phương án thẩm định không được vượt quá số đã kiểm đếm.
- Số liệu phê duyệt không được vượt quá số đã trình thẩm định.
- Số tiền/số hộ đã chi trả không được vượt quá số đã phê duyệt.
- Trạng thái "Hoàn thành" của mỗi bước chỉ tự động set khi tổng số liệu các đợt bằng tổng chỉ tiêu tổng thể — không set thủ công.
- Khi validate thất bại, luôn dùng `toast.warning()` với thông báo rõ ràng bằng tiếng Việt, không để lỗi âm thầm.
