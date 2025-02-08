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
  const match = articleNo.match(/(第)\s*(\d+)\s*(條)/);
  if (!match) return articleNo;

  return (
    <span>
      <span>{match[1]}</span>
      <span className="horizontal-number">{match[2]}</span>
      <span>{match[3]}</span>
    </span>
  );
};

const App = () => {
  const [law, setLaw] = useState<LawData | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [isRemovingHighlight, setIsRemovingHighlight] = useState<boolean>(false); // 判斷是否顯示「取消標記」

  useEffect(() => {
    fetch("/ChLaw.json")
      .then((res) => res.json())
      .then((json) => {
        if (json.Laws && json.Laws.length > 0) {
          setLaw(json.Laws[0]);
        }
      })
      .catch((err) => console.error("讀取 JSON 失敗", err));

    const disableTextSelectionMenu = (event: Event) => {
      event.preventDefault();
    };

    document.addEventListener("mouseup", disableTextSelectionMenu);

    return () => {
      document.removeEventListener("mouseup", disableTextSelectionMenu);
    };
  }, []);

  // 監聽滑鼠選取事件
  const handleMouseUp = () => {
    const selectionObj = window.getSelection();
    if (!selectionObj || selectionObj.rangeCount === 0) {
      setPopupPosition(null);
      return;
    }

    const range = selectionObj.getRangeAt(0);
    const selectedText = range.toString().trim();
    if (!selectedText) {
      setPopupPosition(null);
      return;
    }

    // 檢查是否已經標記
    const parentNode = range.commonAncestorContainer.parentNode as HTMLElement;
    const isHighlighted = parentNode && parentNode.closest(".highlight");

    const rect = range.getBoundingClientRect();
    setPopupPosition({ x: rect.left + window.scrollX, y: rect.top + window.scrollY - 30 });
    setIsRemovingHighlight(!!isHighlighted);
  };

  // **🔹 方法：新增標記**
  const applyHighlight = () => {
    const selectionObj = window.getSelection();
    if (!selectionObj || selectionObj.rangeCount === 0) return;

    const range = selectionObj.getRangeAt(0);
    const selectedText = range.toString().trim();
    if (!selectedText) return;

    const span = document.createElement("span");
    span.className = "highlight";
    span.textContent = selectedText;

    range.deleteContents();
    range.insertNode(span);

    selectionObj.removeAllRanges();
    setPopupPosition(null);
  };

  // **🔹 方法：移除標記**
  const removeHighlight = () => {
    const selectionObj = window.getSelection();
    if (!selectionObj || selectionObj.rangeCount === 0) return;

    const range = selectionObj.getRangeAt(0);
    const parentNode = range.commonAncestorContainer.parentNode as HTMLElement;
    if (!parentNode || !parentNode.closest(".highlight")) return;

    const fullText = parentNode.textContent || "";

    if (fullText === range.toString()) {
      // ✅ **(A) 整段標記被選取，完全移除標記**
      const textNode = document.createTextNode(fullText);
      parentNode.replaceWith(textNode);
    } else {
      // ✅ **(B) 只移除部分標記，拆分**
      const beforeText = fullText.substring(0, fullText.indexOf(range.toString()));
      const afterText = fullText.substring(fullText.indexOf(range.toString()) + range.toString().length);

      const beforeNode = beforeText ? document.createTextNode(beforeText) : null;
      const afterNode = afterText ? document.createTextNode(afterText) : null;
      const unmarkedNode = document.createTextNode(range.toString());

      const parent = parentNode.parentNode;
      if (!parent) return;

      if (beforeNode) parent.insertBefore(beforeNode, parentNode);
      parent.insertBefore(unmarkedNode, parentNode);
      if (afterNode) parent.insertBefore(afterNode, parentNode);

      parent.removeChild(parentNode);
    }

    selectionObj.removeAllRanges();
    setPopupPosition(null);
  };

  return (
    <div className="container">
      {law ? (
        <div className="law-container">
          <div className="law-articles" onMouseUp={handleMouseUp}>
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

      {/* 浮動標記按鈕 */}
      {popupPosition && (
        <div className="popup" style={{ top: popupPosition.y, left: popupPosition.x }}>
          {isRemovingHighlight ? (
            <button onClick={removeHighlight}>取消標記</button>
          ) : (
            <button onClick={applyHighlight}>標記</button>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
