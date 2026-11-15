import iconDoMin from '../assets/images/icon_do_min_chien_thuat_1794649252464.jpg';
import iconGiaiMa from '../assets/images/icon_giai_ma_bon_so_1794649251373.jpg';
import iconAnhSang from '../assets/images/icon_ma_tran_anh_sang_1794649249566.jpg';
import iconMatMa from '../assets/images/icon_mat_ma_thi_giac_1794649250687.jpg';
import iconMenhLenh from '../assets/images/icon_menh_lenh_tuyet_doi_1794649247618.jpg';
import iconXepSo from '../assets/images/icon_xep_so_co_dien_1794649250634.jpg';

export type GameId =
  | 'menh-lenh-tuyet-doi'
  | 'hanh-trinh-vo-dinh'
  | 'kakuro-xoay-chuyen'
  | 'so-lien-tranh-ba'
  | 'ma-tran-anh-sang'
  | 'xep-so-co-dien'
  | 'mat-ma-thi-giac'
  | 'giai-ma-bon-so'
  | 'do-min-chien-thuat';

export interface GameCatalogItem {
  id: GameId;
  title: string;
  genre: string;
  specLine: string;
  summary: string;
  iconSrc: string;
  frameColor: string;
}

export const GAMES_CATALOG: GameCatalogItem[] = [
  {
    id: 'menh-lenh-tuyet-doi',
    title: 'MỆNH LỆNH TUYỆT ĐỐI',
    genre: 'Giải đố 3D',
    specLine: 'Không gian 8×8×3 · 192 ô · Trượt thẳng',
    summary:
      'Điều hướng điểm sáng trượt thẳng qua toàn bộ 192 ô trong khối không gian ba chiều bằng chuỗi 6 hướng lệnh ngắn nhất.',
    iconSrc: iconMenhLenh,
    frameColor: '#facc15',
  },
  {
    id: 'hanh-trinh-vo-dinh',
    title: 'HÀNH TRÌNH VÔ ĐỊNH',
    genre: 'Định lý 4 màu',
    specLine: 'Bản đồ Voronoi 200 vùng · 4 màu · Tối ưu màu mục tiêu',
    summary:
      'Tô màu bản đồ Voronoi sao cho không có 2 vùng kề nhau cùng màu, đồng thời sử dụng ít màu mục tiêu nhất có thể.',
    iconSrc: '',
    frameColor: '#22d3ee',
  },
  {
    id: 'kakuro-xoay-chuyen',
    title: 'KAKURO XOAY CHUYỂN',
    genre: 'Số học xoay',
    specLine: 'Lưới thoi 3×3 · Con nít (≤50) & Siêu trí tuệ (≤1000)',
    summary:
      'Xoay các cụm 4 tinh cầu quanh 9 hình thoi sao cho tổng hiện tại khớp hoàn toàn với tổng mục tiêu trên toàn bàn chơi.',
    iconSrc: '',
    frameColor: '#10b981',
  },
  {
    id: 'so-lien-tranh-ba',
    title: 'SỐ LIÊN TRANH BÁ',
    genre: 'Nối số ƯCLN',
    specLine: 'Bảng 8×8 · Đường nối ≤ 3 đoạn · Triệt tiêu ƯCLN',
    summary:
      'Chọn 2 ô nối được tối đa 3 đoạn thẳng và chia cho ƯCLN để triệt tiêu toàn bộ 64 ô số trên bảng.',
    iconSrc: '',
    frameColor: '#f59e0b',
  },
  {
    id: 'ma-tran-anh-sang',
    title: 'MA TRẬN ÁNH SÁNG',
    genre: 'Logic lưới',
    specLine: 'Lưới 5×5 · Đảo trạng thái · Tối ưu bước',
    summary:
      'Mỗi lần chạm sẽ đảo trạng thái sáng/tối của ô đó và 4 ô lân cận. Tắt toàn bộ đèn trên ma trận với số bước ít nhất.',
    iconSrc: iconAnhSang,
    frameColor: '#38bdf8',
  },
  {
    id: 'xep-so-co-dien',
    title: 'XẾP SỐ CỔ ĐIỂN',
    genre: 'Trượt ô',
    specLine: 'Bảng 4×4 · 15 mảnh ghép · Cổ điển',
    summary:
      'Trượt các ô số vào khoảng trống để sắp xếp lại thứ tự từ 1 đến 15 hoàn chỉnh.',
    iconSrc: iconXepSo,
    frameColor: '#fb923c',
  },
  {
    id: 'mat-ma-thi-giac',
    title: 'MẬT MÃ THỊ GIÁC',
    genre: 'Trí nhớ',
    specLine: 'Nhiều cấp độ · Ghi nhớ mẫu hình',
    summary:
      'Quan sát và ghi nhớ vị trí các ô phát sáng trong chớp mắt, sau đó tái hiện chính xác sơ đồ ma trận.',
    iconSrc: iconMatMa,
    frameColor: '#34d399',
  },
  {
    id: 'giai-ma-bon-so',
    title: 'GIẢI MÃ BỐN SỐ',
    genre: 'Suy luận',
    specLine: '4 chữ số · 10 lượt đoán · Phân tích gợi ý',
    summary:
      'Phá khóa mật mã 4 chữ số khác nhau dựa trên số chữ số đúng vị trí và sai vị trí sau mỗi lần thử.',
    iconSrc: iconGiaiMa,
    frameColor: '#a78bfa',
  },
  {
    id: 'do-min-chien-thuat',
    title: 'DÒ MÌN CHIẾN THUẬT',
    genre: 'Chiến thuật',
    specLine: 'Lưới 9×9 · 10 quả mìn · Cắm cờ',
    summary:
      'Mở toàn bộ các ô an toàn dựa theo chỉ số mìn xung quanh và đánh dấu chính xác vị trí nguy hiểm.',
    iconSrc: iconDoMin,
    frameColor: '#f87171',
  },
];
