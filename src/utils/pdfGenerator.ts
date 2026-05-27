import { jsPDF } from 'jspdf';
import { format } from 'date-fns';
import { Member } from '../types';
import { STAMP_BASE64 } from './stampBase64';

export function generateInvoicePDF(member: Member): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Color Palette
  const colors = {
    primary: [15, 23, 42],       // #0f172a Slate 900
    accent: [37, 99, 235],       // #2563eb Blue 600
    textDark: [51, 65, 85],      // #334155 Slate 700
    textLight: [148, 163, 184], // #94a3b8 Slate 400
    bgLight: [248, 250, 252],   // #f8fafc Slate 50
    border: [226, 232, 240],     // #e2e8f0 Slate 200
    paidGreen: [16, 185, 129],  // #10b981 Emerald 500
    unpaidRed: [239, 68, 68],    // #ef4444 Red 500
  };

  const formattedJoinDate = format(new Date(member.joinDate), 'MMM dd, yyyy');
  const formattedExpiryDate = format(new Date(member.expiryDate), 'MMM dd, yyyy');
  const invoiceNum = `FC-INV-${member.id.substring(0, 8).toUpperCase()}`;

  // 1. Sleek Header Banner
  doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.rect(0, 0, 210, 42, 'F');

  // Brand Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('FIGHT CLUB GYM', 16, 18);

  // Brand Subtitle
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text('THE ULTIMATE TRAINING GROUND & FITNESS ZONE', 16, 23);

  // Invoice Title Right Aligned
  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('MEMBERSHIP BILL', 194, 18, { align: 'right' });

  // Invoice Details Right Aligned
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(190, 190, 190);
  doc.text(`Invoice No: ${invoiceNum}`, 194, 25, { align: 'right' });
  doc.text(`Date: ${formattedJoinDate}`, 194, 30, { align: 'right' });

  // Decorative Accent line in Header
  doc.setFillColor(colors.accent[0], colors.accent[1], colors.accent[2]);
  doc.rect(0, 41, 210, 1, 'F');

  // Move down for body contents
  let y = 56;

  // 2. Billed To & Gym Address (Two columns layout)
  // Column 1: Billed To
  doc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('BILLED TO', 16, y);

  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[1]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(member.name, 16, y + 5);

  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Phone: ${member.phone}`, 16, y + 10);
  doc.text(`Email: ${member.email || 'N/A'}`, 16, y + 15);

  // Column 2: Provided By
  doc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('ISSUED BY', 120, y);

  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('FIGHT CLUB HEALTHCARE', 120, y + 5);

  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Owner: Akshay Choudhari', 120, y + 10);
  doc.text('Phone: +91 83086 28416', 120, y + 15);

  // horizontal line separator
  y += 24;
  doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
  doc.setLineWidth(0.3);
  doc.line(16, y, 194, y);

  // 3. Subscription details Table
  y += 10;
  doc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('MEMBERSHIP DESCRIPTION', 16, y);
  doc.text('VALIDITY PERIOD', 110, y);
  doc.text('PRICE', 194, y, { align: 'right' });

  // Table header bottom line
  y += 3;
  doc.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setLineWidth(0.4);
  doc.line(16, y, 194, y);

  // Rows Background highlight
  y += 2;
  doc.setFillColor(colors.bgLight[0], colors.bgLight[1], colors.bgLight[2]);
  doc.rect(16, y, 178, 15, 'F');

  // Subscription item content
  y += 9;
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(member.planName, 20, y);

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.text(`${formattedJoinDate} to ${formattedExpiryDate}`, 110, y);

  doc.setFont('Helvetica', 'bold');
  doc.text(`Rs. ${member.planPrice}`, 190, y, { align: 'right' });

  // Sub-row line
  y += 6;
  doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
  doc.setLineWidth(0.3);
  doc.line(16, y, 194, y);

  // 4. Financial breakdown (Subtotal, Tax, Net Total)
  y += 12;
  const isPaid = member.paymentStatus === 'paid';

  // Left Content: Payment status and instructions badge
  doc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('PAYMENT DETAILS', 16, y);

  // Payment badge box
  const statusColor = isPaid ? colors.paidGreen : colors.unpaidRed;
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.rect(16, y + 3, 40, 7.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(isPaid ? 'STATUS: PAID' : 'STATUS: PENDING', 36, y + 8, { align: 'center' });

  // Payment date
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Payment Receipt Date: ${member.lastPaymentDate ? format(new Date(member.lastPaymentDate), 'MMM dd, yyyy') : formattedJoinDate}`, 16, y + 16);

  // Right Content: Calculations
  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Subtotal:', 140, y + 3, { align: 'right' });
  doc.text(`Rs. ${member.planPrice}`, 194, y + 3, { align: 'right' });

  doc.text('SGST/CGST (0%):', 140, y + 8, { align: 'right' });
  doc.text('Rs. 0', 194, y + 8, { align: 'right' });

  // Divider for Total
  doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
  doc.line(120, y + 12, 194, y + 12);

  // Grand Total
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text('Total Amount Due:', 140, y + 17, { align: 'right' });
  doc.text(`Rs. ${member.planPrice}`, 194, y + 17, { align: 'right' });

  // Divider line
  y += 32;
  doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2]);
  doc.line(16, y, 194, y);

  // 5. Terms / Information Section (Bento info card)
  y += 8;
  doc.setFillColor(colors.bgLight[0], colors.bgLight[1], colors.bgLight[2]);
  doc.rect(16, y, 178, 28, 'F');

  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('IMPORTANT MEMBERSHIP RULES & CONDITIONS', 22, y + 6);

  doc.setTextColor(colors.textDark[0], colors.textDark[1], colors.textDark[2]);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('1. Present your registered QR code for check-in at the gym terminal daily.', 22, y + 12);
  doc.text('2. Memberships are non-refundable & non-transferable. Fees once paid will not be returned.', 22, y + 17);
  doc.text('3. Rules: "First rule of Fight Club matches: consistency and progression. Train hard, stay clean."', 22, y + 22);

  // 6. Signatures and Official Stamp (Mock)
  y += 34;
  doc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('MEMBER SIGNATURE', 16, y);
  doc.line(16, y - 1, 55, y - 1);

  doc.text('AUTHORIZED SIGNATURE / MANAGER', 194, y, { align: 'right' });
  doc.line(155, y - 1, 194, y - 1);

  // --- FIGHT CLUB GYM OFFICIAL DIGITAL AUTHORIZED STAMP ---
  const cx = 174;
  const cy = y - 14;

  try {
    // Preserve perfect aspect ratio of 1.8315 without vertical stretching (width 36.6mm, height 20mm)
    doc.addImage(STAMP_BASE64, 'PNG', cx - 18.3, cy - 10, 36.6, 20);
  } catch (error) {
    console.error("Error adding stamp image:", error);
  }

  // 7. Footer
  y += 18;
  doc.setTextColor(colors.textLight[0], colors.textLight[1], colors.textLight[2]);
  doc.setFont('Helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('FIGHT CLUB GROUP & FITNESS COMPANY', 105, y, { align: 'center' });

  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('Thank you for choosing Fight Club Gym! Keep pushing your limits.', 105, y + 4, { align: 'center' });

  return doc;
}
