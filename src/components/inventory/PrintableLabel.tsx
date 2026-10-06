import React from "react";
import { QRCodeSVG } from "qrcode.react";

export interface LabelPrintItem {
  name: string;
  brand?: string | null;
  sku: string;
  price: number;
  qrCode: string;
  location?: string | null;
}

interface PrintableLabelProps {
  items: LabelPrintItem[];
}

export const PrintableLabel = React.forwardRef<HTMLDivElement, PrintableLabelProps>(
  ({ items }, ref) => {
    return (
      <div 
        ref={ref} 
        className="printable-label-batch hidden print:block"
        style={{
          backgroundColor: "#ffffff",
          color: "#000000",
        }}
      >
        {items.map((item, idx) => (
          <div
            key={`${item.qrCode}-${idx}`}
            className="single-label-sticker"
            style={{
              width: "50mm",
              height: "30mm",
              padding: "2.5mm",
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              fontFamily: "monospace",
              fontSize: "8px",
              lineHeight: "1.2",
              pageBreakInside: "avoid",
              breakInside: "avoid",
            }}
          >
            {/* Left Side: Product Information */}
            <div 
              style={{ 
                display: "flex", 
                flexDirection: "column", 
                width: "58%", 
                height: "100%",
                justifyContent: "space-between",
                overflow: "hidden" 
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                {/* Title */}
                <div 
                  style={{ 
                    fontWeight: "bold", 
                    fontSize: "8.5px", 
                    maxHeight: "22px",
                    overflow: "hidden", 
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    textOverflow: "ellipsis"
                  }}
                >
                  {item.name}
                </div>
                {/* Brand */}
                {item.brand && (
                  <div style={{ fontSize: "7px", opacity: 0.8, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    {item.brand}
                  </div>
                )}
              </div>

              {/* Price, SKU & Location */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                <div style={{ fontWeight: "bold", fontSize: "7.5px" }}>
                  Rs.{item.price.toFixed(2)}
                </div>
                <div style={{ fontSize: "6.5px", whiteSpace: "nowrap" }}>
                  SKU: {item.sku}
                </div>
                {item.location && (
                  <div style={{ fontSize: "6.5px", fontStyle: "italic", whiteSpace: "nowrap" }}>
                    Loc: {item.location}
                  </div>
                )}
              </div>
            </div>

            {/* Right Side: QR Code */}
            <div 
              style={{ 
                width: "38%", 
                height: "100%",
                display: "flex", 
                flexDirection: "column",
                alignItems: "center", 
                justifyContent: "center",
                gap: "2px"
              }}
            >
              <QRCodeSVG 
                value={item.qrCode} 
                size={55} 
                level="M" 
                includeMargin={false}
              />
              <div 
                style={{ 
                  fontSize: "5.5px", 
                  fontWeight: "bold",
                  textAlign: "center",
                  overflow: "hidden",
                  width: "100%",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}
              >
                {item.qrCode}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }
);

PrintableLabel.displayName = "PrintableLabel";
