"""
Seed script for PG-NEXUS platform.
Run with: python scripts/seed.py  (from the backend/ directory)
"""
import asyncio
import sys
import os
import uuid
from datetime import datetime, timezone

# Ensure app package is importable when running from scripts/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import AsyncSessionLocal
from app.models.models import User, PGPassport, Quiz, VoiceScenario, UserRole

# ---------------------------------------------------------------------------
# Quiz data
# ---------------------------------------------------------------------------

QUIZ_1_PRODUCT_KNOWLEDGE = {
    "title": "Kiến thức sản phẩm Masan Consumer",
    "description": "Bài kiểm tra kiến thức về các sản phẩm của Masan Consumer tại BHX",
    "category": "product_knowledge",
    "competency_target": "c3",
    "time_limit_seconds": 180,
    "questions": [
        {
            "id": "q1",
            "text": "Mì Omachi được làm từ nguyên liệu chính nào khác biệt so với mì thông thường?",
            "image_url": None,
            "options": [
                "A. Bột mì nguyên cám",
                "B. Khoai tây",
                "C. Gạo lứt",
                "D. Bột ngô",
            ],
            "correct": "B",
            "explanation": "Mì Omachi được làm từ khoai tây, tạo nên hương vị và kết cấu đặc biệt không bị nát khi nấu lâu.",
        },
        {
            "id": "q2",
            "text": "Tương ớt Chinsu có bao nhiêu hương vị khác nhau trong dòng sản phẩm chính?",
            "image_url": None,
            "options": [
                "A. 2 hương vị",
                "B. 3 hương vị",
                "C. 4 hương vị",
                "D. 5 hương vị",
            ],
            "correct": "C",
            "explanation": "Chinsu có 4 hương vị chính: Tương ớt, Tương ớt tỏi, Tương ớt chanh leo và Tương ớt đặc biệt.",
        },
        {
            "id": "q3",
            "text": "Nước mắm Nam Ngư được sản xuất chủ yếu tại đâu?",
            "image_url": None,
            "options": [
                "A. Phú Quốc",
                "B. Nha Trang",
                "C. Phan Thiết",
                "D. Cà Mau",
            ],
            "correct": "A",
            "explanation": "Nước mắm Nam Ngư nổi tiếng với nguồn gốc từ Phú Quốc, sử dụng cá cơm tươi ủ chượp theo phương pháp truyền thống.",
        },
    ],
}

QUIZ_2_SALES_PROCESS = {
    "title": "Quy trình bán hàng 5 bước",
    "description": "Kiểm tra kiến thức về quy trình bán hàng chuẩn của PG tại BHX",
    "category": "process",
    "competency_target": "c1",
    "time_limit_seconds": 180,
    "questions": [
        {
            "id": "q1",
            "text": "Quy trình bán hàng chuẩn của PG Masan tại BHX gồm mấy bước?",
            "image_url": None,
            "options": ["A. 3 bước", "B. 4 bước", "C. 5 bước", "D. 6 bước"],
            "correct": "C",
            "explanation": "Quy trình bán hàng chuẩn gồm 5 bước: Tiếp cận - Khơi gợi nhu cầu - Tư vấn sản phẩm - Xử lý phản bác - Chốt sale.",
        },
        {
            "id": "q2",
            "text": "Bước đầu tiên trong quy trình bán hàng 5 bước là gì?",
            "image_url": None,
            "options": [
                "A. Giới thiệu sản phẩm ngay lập tức",
                "B. Tiếp cận và thiết lập kết nối với khách hàng",
                "C. Hỏi khách hàng cần mua gì",
                "D. Đưa ra ưu đãi khuyến mãi",
            ],
            "correct": "B",
            "explanation": "Bước 1 là Tiếp cận & Thiết lập kết nối - tạo ấn tượng tích cực đầu tiên, chào hỏi thân thiện trước khi giới thiệu sản phẩm.",
        },
        {
            "id": "q3",
            "text": "Trong bước 'Khơi gợi nhu cầu', PG nên làm gì?",
            "image_url": None,
            "options": [
                "A. Liệt kê tất cả sản phẩm đang khuyến mãi",
                "B. Đặt câu hỏi để hiểu thói quen và nhu cầu của khách",
                "C. Chỉ tay vào kệ hàng",
                "D. Đưa sản phẩm vào giỏ hàng của khách",
            ],
            "correct": "B",
            "explanation": "Bước 2 là đặt câu hỏi mở để hiểu nhu cầu thực sự của khách: họ nấu ăn cho bao nhiêu người? Thường mua loại nào? - Từ đó tư vấn phù hợp.",
        },
    ],
}

QUIZ_3_PROMOTIONS = {
    "title": "Khuyến mãi & Ngày đôi BHX",
    "description": "Kiểm tra kiến thức về chương trình khuyến mãi, ngày đôi và chính sách Tết",
    "category": "promotion",
    "competency_target": "c4",
    "time_limit_seconds": 180,
    "questions": [
        {
            "id": "q1",
            "text": "Ngày đôi tại BHX diễn ra vào ngày nào hàng tháng?",
            "image_url": None,
            "options": [
                "A. Ngày 1 và 15 hàng tháng",
                "B. Ngày 10 và 20 hàng tháng",
                "C. Ngày đôi (2/2, 4/4, 6/6...) trong năm",
                "D. Mỗi chủ nhật đầu tháng",
            ],
            "correct": "C",
            "explanation": "Ngày đôi BHX là các ngày có số trùng nhau trong năm: 2/2, 4/4, 6/6, 8/8, 10/10, 12/12 - dịp khuyến mãi lớn.",
        },
        {
            "id": "q2",
            "text": "Trong ngày đôi BHX, nhiệm vụ quan trọng nhất của PG là gì?",
            "image_url": None,
            "options": [
                "A. Đảm bảo hàng hóa đầy đủ trên kệ và hỗ trợ khách hàng chủ động",
                "B. Chỉ bán sản phẩm đang giảm giá",
                "C. Không cần làm gì vì khách tự biết mua",
                "D. Tập trung vào sản phẩm có lợi nhuận cao nhất",
            ],
            "correct": "A",
            "explanation": "Ngày đôi là ngày bán hàng cao điểm. PG phải đảm bảo kệ đầy hàng, chủ động tiếp cận khách và tư vấn về các ưu đãi đang áp dụng.",
        },
        {
            "id": "q3",
            "text": "Chương trình 'Mua 2 tặng 1' cho mì Omachi áp dụng như thế nào?",
            "image_url": None,
            "options": [
                "A. Mua 2 thùng tặng 1 thùng",
                "B. Mua 2 gói tặng 1 gói trong cùng một hương vị",
                "C. Theo điều kiện cụ thể của từng đợt khuyến mãi",
                "D. Tự động áp dụng khi thanh toán",
            ],
            "correct": "C",
            "explanation": "Điều kiện khuyến mãi 'Mua 2 tặng 1' thay đổi theo từng đợt và sản phẩm cụ thể. PG cần nắm rõ điều kiện của đợt KM hiện tại.",
        },
    ],
}

# ---------------------------------------------------------------------------
# Voice Scenario data
# ---------------------------------------------------------------------------

VOICE_SCENARIOS = [
    {
        "title": "Khách hàng khó tính - Nước mắm mặn",
        "description": "Khách hàng phàn nàn về việc nước mắm Nam Ngư quá mặn và muốn đổi sản phẩm. PG cần xử lý phản bác và duy trì niềm tin vào sản phẩm.",
        "scenario_type": "customer_objection",
        "target_competencies": ["c5", "c3"],
        "difficulty": 2,
        "duration_minutes": 7,
        "persona_prompt": """Bạn đóng vai bà Lan, 45 tuổi, nội trợ, đang mua sắm tại BHX.
Bà vừa mua nước mắm Nam Ngư tuần trước và thấy nó quá mặn so với nước mắm bà thường dùng.
Bà đang đứng trước kệ nước mắm, nhìn vào chai Nam Ngư với vẻ không hài lòng.

TÍNH CÁCH:
- Thẳng thắn, hơi bực bội nhưng không thô lỗ
- Quan tâm đến sức khỏe gia đình
- Nghi ngờ về chất lượng sản phẩm

PHẢN BÁC CỐT LÕI:
1. "Nước mắm này mặn quá, con tôi không ăn được"
2. "Tôi dùng loại khác bao năm nay, chưa thấy mặn như vậy"
3. "Giá cao hơn mà lại không ngon bằng"

QUY TẮC ỨNG XỬ:
- Bắt đầu với thái độ không hài lòng nhưng sẵn sàng lắng nghe
- Nếu PG lắng nghe và đồng cảm tốt → mở lòng hơn
- Nếu PG giải thích được về độ đạm và cách pha loãng → bắt đầu cân nhắc
- Nếu PG đề xuất giải pháp cụ thể (mua thêm loại khác, hướng dẫn pha) → có thể thay đổi quyết định
- Nếu PG cãi hoặc phủ nhận cảm nhận của bà → từ chối và muốn gặp quản lý

THÔNG TIN KỸ THUẬT BÀ LAN MUỐN BIẾT:
- Tại sao nước mắm này mặn hơn?
- Cách sử dụng đúng để không quá mặn?
- Có loại nước mắm nào phù hợp hơn không?

Hãy phản hồi tự nhiên, thực tế như một khách hàng thật. Nói tiếng Việt hoàn toàn. Câu trả lời ngắn gọn 1-3 câu.""",
    },
    {
        "title": "Cửa hàng trưởng muốn giảm diện tích kệ Masan",
        "description": "Cửa hàng trưởng BHX thông báo muốn cắt giảm diện tích kệ của Masan để nhường chỗ cho đối thủ. PG cần đàm phán và thuyết phục giữ nguyên hoặc tăng diện tích kệ.",
        "scenario_type": "store_manager_negotiation",
        "target_competencies": ["c6", "c5", "c2"],
        "difficulty": 4,
        "duration_minutes": 10,
        "persona_prompt": """Bạn đóng vai anh Hùng, 38 tuổi, cửa hàng trưởng BHX chi nhánh Quận 7.
Anh đang có áp lực từ công ty phải tối ưu doanh thu mét vuông kệ.
Anh vừa nhận đề nghị từ đối thủ của Masan (một thương hiệu khác) muốn tăng diện tích trưng bày với chiết khấu hấp dẫn hơn.

TÌNH HUỐNG:
Doanh số mì Masan tháng này thấp hơn target 15%.
Đối thủ đề nghị hỗ trợ POSM (vật phẩm trưng bày) và chiết khấu thêm 3%.

PHẢN BÁC CỐT LÕI:
1. "Doanh số Masan tháng này thấp, tôi cần tối ưu kệ hàng"
2. "Nhà cung cấp kia cho tôi điều kiện tốt hơn"
3. "Khách hàng bây giờ hay mua hàng thay thế hơn"
4. "Tôi cần thấy kế hoạch cụ thể từ Masan trước khi quyết định"

QUY TẮC ỨNG XỬ:
- Bắt đầu với thái độ dứt khoát, muốn giảm kệ Masan 30%
- Nếu PG phân tích được dữ liệu bán hàng thuyết phục → cân nhắc lại
- Nếu PG đề xuất action plan cụ thể (tăng hoạt động sampling, activation) → mở ra thương lượng
- Nếu PG hỏi về điều kiện đối thủ để counter → cung cấp thông tin và chờ đề xuất
- Nếu PG đưa ra cam kết cụ thể về doanh số → có thể giữ nguyên diện tích kệ với điều kiện
- Nếu PG không có lập luận tốt → kiên quyết giảm kệ

Nói tiếng Việt, phong cách chuyên nghiệp nhưng thực dụng. Câu trả lời 2-4 câu.""",
    },
    {
        "title": "Bán hàng đầy đủ - Quy trình 5 bước hoàn chỉnh",
        "description": "Khách hàng mới lần đầu đến BHX, chưa quen với sản phẩm Masan. PG thực hành toàn bộ quy trình 5 bước từ tiếp cận đến chốt sale.",
        "scenario_type": "full_sales_process",
        "target_competencies": ["c1", "c2", "c3", "c4", "c5"],
        "difficulty": 3,
        "duration_minutes": 10,
        "persona_prompt": """Bạn đóng vai anh Minh, 28 tuổi, vừa chuyển đến khu vực mới, lần đầu mua sắm tại BHX này.
Anh đang đứng tại khu vực mì và gia vị, nhìn xung quanh với vẻ bối rối.
Anh thường nấu ăn tại nhà cho hai vợ chồng, thích ẩm thực Việt nhưng cũng muốn thử món mới.

THÔNG TIN ẨN:
- Ngân sách: tầm 200.000-300.000đ cho gia vị và mì
- Thói quen: hay mua mì gói nhưng chưa biết Omachi
- Quan tâm: sản phẩm không chứa nhiều hóa chất, tốt cho sức khỏe
- Vợ anh đang mang thai → quan tâm đặc biệt đến độ an toàn thực phẩm

HÀNH VI BAN ĐẦU:
- Nhìn kệ hàng không biết chọn gì
- Sẽ hỏi nếu PG chủ động tiếp cận
- Không vội vàng, sẵn sàng nghe tư vấn

TIẾN TRÌNH THEO QUY TRÌNH PG:
- Nếu PG chào hỏi tự nhiên, thân thiện → mở lòng chia sẻ nhu cầu
- Nếu PG hỏi về thói quen nấu ăn → tiết lộ thông tin về vợ mang thai
- Nếu PG giới thiệu Omachi với lý do phù hợp (làm từ khoai tây, ít hóa chất) → quan tâm hỏi thêm
- Nếu PG gợi ý thêm nước mắm/tương ớt phù hợp → có thể mua cả combo
- Nếu PG chốt sale khéo → quyết định mua

TIẾN TRÌNH KHÔNG TỐT:
- Nếu PG chỉ đứng không chủ động → anh Minh tự chọn sản phẩm ngẫu nhiên và đi
- Nếu PG giới thiệu không liên quan đến nhu cầu → lịch sự từ chối và đi

Nói tiếng Việt thân thiện, tự nhiên. Câu trả lời 2-3 câu.""",
    },
]

# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

USERS = [
    {
        "email": "admin@pgnexus.com",
        "full_name": "Admin PG-NEXUS",
        "phone": "0900000000",
        "role": UserRole.ADMIN,
        "store_code": None,
        "region": None,
    },
    {
        "email": "pg1@pgnexus.com",
        "full_name": "Nguyễn Thị Hoa",
        "phone": "0901111111",
        "role": UserRole.PG,
        "store_code": "BHX-Q7-001",
        "region": "TP.HCM - Quận 7",
    },
    {
        "email": "pg2@pgnexus.com",
        "full_name": "Trần Văn Nam",
        "phone": "0902222222",
        "role": UserRole.PG,
        "store_code": "BHX-Q1-015",
        "region": "TP.HCM - Quận 1",
    },
    {
        "email": "pg3@pgnexus.com",
        "full_name": "Lê Thị Bích",
        "phone": "0903333333",
        "role": UserRole.PG,
        "store_code": "BHX-TD-008",
        "region": "TP.HCM - Tân Định",
    },
]

PG_PASSPORT_SCORES = [
    # pg1 - strong performer
    {
        "c1_approach": 3.5,
        "c2_discovery": 3.2,
        "c3_storytelling": 3.8,
        "c4_expansion": 3.0,
        "c5_objection": 2.8,
        "c6_negotiation": 2.5,
        "c7_discipline": 3.9,
        "total_points": 1250,
        "is_initialized": True,
    },
    # pg2 - average, has red flags
    {
        "c1_approach": 2.5,
        "c2_discovery": 1.8,
        "c3_storytelling": 2.2,
        "c4_expansion": 1.9,
        "c5_objection": 2.0,
        "c6_negotiation": 1.5,
        "c7_discipline": 2.8,
        "total_points": 680,
        "is_initialized": True,
    },
    # pg3 - new, not yet initialized
    {
        "c1_approach": 0.0,
        "c2_discovery": 0.0,
        "c3_storytelling": 0.0,
        "c4_expansion": 0.0,
        "c5_objection": 0.0,
        "c6_negotiation": 0.0,
        "c7_discipline": 0.0,
        "total_points": 0,
        "is_initialized": False,
    },
]

def compute_overall(scores: dict) -> tuple[float, list]:
    """Compute overall score and red flags."""
    competency_keys = ["c1_approach", "c2_discovery", "c3_storytelling",
                       "c4_expansion", "c5_objection", "c6_negotiation", "c7_discipline"]
    values = [scores[k] for k in competency_keys]
    non_zero = [v for v in values if v > 0]
    overall = sum(non_zero) / len(non_zero) if non_zero else 0.0
    red_flags = [k for k in competency_keys if 0 < scores[k] < 2.0]
    return round(overall, 2), red_flags

async def seed_data():
    print("Starting database seeding...")
    async with AsyncSessionLocal() as session:
        # Check if already seeded
        from sqlalchemy import select
        result = await session.execute(select(User).limit(1))
        if result.scalar_one_or_none():
            print("Database already contains data. Skipping seed.")
            return

        # 1. Users & Passports
        for i, u_data in enumerate(USERS):
            user = User(
                id=str(uuid.uuid4()),
                email=u_data["email"],
                full_name=u_data["full_name"],
                phone=u_data["phone"],
                role=u_data["role"],
                store_code=u_data["store_code"],
                region=u_data["region"],
            )
            session.add(user)
            await session.commit()
            
            if user.role == UserRole.PG:
                score_data = PG_PASSPORT_SCORES[i - 1]  # pg users start at index 1
                overall_score, red_flags = compute_overall(score_data)
                
                passport = PGPassport(
                    id=str(uuid.uuid4()),
                    user_id=user.id,
                    c1_approach=score_data["c1_approach"],
                    c2_discovery=score_data["c2_discovery"],
                    c3_storytelling=score_data["c3_storytelling"],
                    c4_expansion=score_data["c4_expansion"],
                    c5_objection=score_data["c5_objection"],
                    c6_negotiation=score_data["c6_negotiation"],
                    c7_discipline=score_data["c7_discipline"],
                    total_points=score_data["total_points"],
                    is_initialized=score_data["is_initialized"],
                    overall_score=overall_score,
                    red_flags=red_flags,
                    last_assessment_at=datetime.now(timezone.utc) if score_data["is_initialized"] else None
                )
                session.add(passport)

        # 2. Quizzes
        quizzes = [QUIZ_1_PRODUCT_KNOWLEDGE, QUIZ_2_SALES_PROCESS, QUIZ_3_PROMOTIONS]
        for q_data in quizzes:
            quiz = Quiz(
                id=str(uuid.uuid4()),
                title=q_data["title"],
                description=q_data["description"],
                category=q_data["category"],
                competency_target=q_data["competency_target"],
                time_limit_seconds=q_data["time_limit_seconds"],
                questions=q_data["questions"]
            )
            session.add(quiz)

        # 3. Scenarios
        for s_data in VOICE_SCENARIOS:
            scenario = VoiceScenario(
                id=str(uuid.uuid4()),
                title=s_data["title"],
                description=s_data["description"],
                scenario_type=s_data["scenario_type"],
                target_competencies=s_data["target_competencies"],
                difficulty=s_data["difficulty"],
                duration_minutes=s_data["duration_minutes"],
                persona_prompt=s_data["persona_prompt"]
            )
            session.add(scenario)

        await session.commit()
        print("Database seeding completed successfully.")

if __name__ == "__main__":
    asyncio.run(seed_data())
