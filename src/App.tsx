import { useEffect, useState } from "react";
import "./App.css";

interface LawArticle {
  ArticleNo: string;
  ArticleContent: string;
}

interface LawData {
  LawName: string;
  LawModifiedDate: string;
  LawArticles: LawArticle[];
}

const formatArticleNo = (articleNo: string) => {
  // ✅ 允許「第」「數字」「條」之間有空格
  const match = articleNo.match(/(第)\s*(\d+)\s*(條)/);

  if (!match) return articleNo; // 如果格式不符，直接回傳原本的字串

  return (
    <span>
      <span>{match[1]}</span> {/* "第" 保持直排 */}
      <span className="horizontal-number">{match[2]}</span> {/* 數字變橫向 */}
      <span>{match[3]}</span> {/* "條" 保持直排 */}
    </span>
  );
};


const App = () => {
  const [law, setLaw] = useState<LawData | null>(null);

  useEffect(() => {
    fetch("/ChLaw.json")
      .then((res) => res.json())
      .then((json) => {
        if (json.Laws && json.Laws.length > 0) {
          setLaw(json.Laws[0]); // 只顯示第一部法典
        }
      })
      .catch((err) => console.error("讀取 JSON 失敗", err));
  }, []);

  return (
    <div className="container">
      {law ? (
        <div className="law-container">
          <div className="law-articles">
            <span className="law-title">{law.LawName}</span>
            <p className="law-date">最後修訂日期：
              <span className="vertical-numbers">
                {law.LawModifiedDate}
              </span>
            </p>
            {law.LawArticles.slice().map((article, index) => (
              <div key={index}>
                <strong>{formatArticleNo(article.ArticleNo)}</strong>
                <p>{article.ArticleContent}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p>載入中...</p>
      )}
    </div>
  );
};

export default App;
