/**
 * Schedule Export Utility
 * Provides Excel and PDF export functionality for schedules
 * Uses SheetJS (xlsx) for Excel and jsPDF for PDF
 */

class ScheduleExporter {
    constructor() {
        this.loadedLibraries = {
            xlsx: false,
            jspdf: false,
            autoTable: false
        };
    }

    /**
     * Load required libraries dynamically
     */
    async loadLibraries() {
        if (this.loadedLibraries.xlsx && this.loadedLibraries.jspdf && this.loadedLibraries.autoTable) {
            return true;
        }

        try {
            // Load SheetJS for Excel export
            if (!this.loadedLibraries.xlsx) {
                await this.loadScript('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js');
                this.loadedLibraries.xlsx = true;
            }

            // Load jsPDF for PDF export
            if (!this.loadedLibraries.jspdf) {
                await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
                this.loadedLibraries.jspdf = true;
            }

            // Load jsPDF-AutoTable for table formatting
            if (!this.loadedLibraries.autoTable) {
                await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.7.1/jspdf.plugin.autotable.min.js');
                this.loadedLibraries.autoTable = true;
            }

            console.log('✅ Export libraries loaded successfully');
            return true;
        } catch (error) {
            console.error('❌ Error loading export libraries:', error);
            throw new Error('Failed to load export libraries');
        }
    }

    /**
     * Load external script dynamically
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Format schedule data for export (role-aware)
     */
    formatScheduleData(schedules, userInfo = {}) {
        const userRole = userInfo.role || '';
        
        return schedules.map(schedule => {
            const subjectCode = schedule.subject?.courseCode || schedule.subject || 'N/A';
            const subjectTitle = schedule.subject?.descriptiveTitle || '';
            const teacherName = schedule.teacher?.fullname || schedule.teacher || 'N/A';
            const sectionName = schedule.section?.sectionName || schedule.section || 'N/A';
            const roomName = schedule.room?.roomName || schedule.room || 'N/A';
            const timeDisplay = `${schedule.startTime} ${schedule.startPeriod} - ${schedule.endTime} ${schedule.endPeriod}`;
            const scheduleType = schedule.scheduleType ? schedule.scheduleType.charAt(0).toUpperCase() + schedule.scheduleType.slice(1) : 'N/A';

            const row = {
                'Day': schedule.day || 'N/A',
                'Time': timeDisplay,
                'Subject Code': subjectCode,
                'Subject Title': subjectTitle
            };

            // Add Teacher column only if user is NOT a teacher
            if (userRole !== 'Teacher') {
                row['Teacher'] = teacherName;
            }

            // Add Section column only if user is NOT a student
            if (userRole !== 'Student') {
                row['Section'] = sectionName;
            }

            row['Room'] = roomName;
            row['Type'] = scheduleType;

            return row;
        });
    }

    /**
     * Sort schedules by day and time
     */
    sortSchedules(schedules) {
        const dayOrder = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 7 };
        
        return schedules.sort((a, b) => {
            // Sort by day first
            const dayDiff = (dayOrder[a.day] || 99) - (dayOrder[b.day] || 99);
            if (dayDiff !== 0) return dayDiff;

            // Then sort by time
            const getTimeValue = (schedule) => {
                let timeValue = parseInt(schedule.startTime.replace(':', ''));
                if (schedule.startPeriod === 'PM' && timeValue < 1200) timeValue += 1200;
                if (schedule.startPeriod === 'AM' && timeValue === 1200) timeValue = 0;
                return timeValue;
            };

            return getTimeValue(a) - getTimeValue(b);
        });
    }

    /**
     * Export schedules to Excel with professional styling
     */
    async exportToExcel(schedules, filename = 'schedule', userInfo = {}) {
        try {
            await this.loadLibraries();

            if (!schedules || schedules.length === 0) {
                throw new Error('No schedules to export');
            }

            // Sort schedules
            const sortedSchedules = this.sortSchedules([...schedules]);

            // Format data
            const formattedData = this.formatScheduleData(sortedSchedules, userInfo);

            // Create workbook
            const wb = window.XLSX.utils.book_new();

            // Create worksheet with empty data first
            const ws = window.XLSX.utils.aoa_to_sheet([]);

            // Define CTU colors
            const ctuDeepBlue = { rgb: "002D62" };
            const ctuGold = { rgb: "F2D283" };
            const ctuLightBlue = { rgb: "3E8EDE" };
            const white = { rgb: "FFFFFF" };
            const lightGray = { rgb: "F4F7F9" };
            const darkGray = { rgb: "555555" };

            // Title row styling
            const titleStyle = {
                font: { name: 'Calibri', sz: 18, bold: true, color: ctuDeepBlue },
                alignment: { horizontal: 'left', vertical: 'center' },
                fill: { fgColor: white }
            };

            // Header info styling
            const headerLabelStyle = {
                font: { name: 'Calibri', sz: 11, bold: true, color: ctuDeepBlue },
                alignment: { horizontal: 'left', vertical: 'center' },
                fill: { fgColor: lightGray }
            };

            const headerValueStyle = {
                font: { name: 'Calibri', sz: 11, color: darkGray },
                alignment: { horizontal: 'left', vertical: 'center' },
                fill: { fgColor: lightGray }
            };

            // Table header styling
            const tableHeaderStyle = {
                font: { name: 'Calibri', sz: 11, bold: true, color: white },
                alignment: { horizontal: 'center', vertical: 'center' },
                fill: { fgColor: ctuDeepBlue },
                border: {
                    top: { style: 'thin', color: { rgb: "000000" } },
                    bottom: { style: 'thin', color: { rgb: "000000" } },
                    left: { style: 'thin', color: { rgb: "000000" } },
                    right: { style: 'thin', color: { rgb: "000000" } }
                }
            };

            // Table cell styling (alternating rows)
            const tableCellStyleEven = {
                font: { name: 'Calibri', sz: 10, color: darkGray },
                alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
                fill: { fgColor: white },
                border: {
                    top: { style: 'thin', color: { rgb: "E0E0E0" } },
                    bottom: { style: 'thin', color: { rgb: "E0E0E0" } },
                    left: { style: 'thin', color: { rgb: "E0E0E0" } },
                    right: { style: 'thin', color: { rgb: "E0E0E0" } }
                }
            };

            const tableCellStyleOdd = {
                font: { name: 'Calibri', sz: 10, color: darkGray },
                alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
                fill: { fgColor: lightGray },
                border: {
                    top: { style: 'thin', color: { rgb: "E0E0E0" } },
                    bottom: { style: 'thin', color: { rgb: "E0E0E0" } },
                    left: { style: 'thin', color: { rgb: "E0E0E0" } },
                    right: { style: 'thin', color: { rgb: "E0E0E0" } }
                }
            };

            let currentRow = 0;

            // Add title
            ws['A1'] = { v: 'CHRONIX - Class Schedule', t: 's', s: titleStyle };
            ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
            currentRow = 2;

            // Add header information
            const headerInfo = [];
            if (userInfo.name) headerInfo.push(['Name:', userInfo.name]);
            if (userInfo.role) headerInfo.push(['Role:', userInfo.role]);
            if (userInfo.section) headerInfo.push(['Section:', userInfo.section]);
            if (userInfo.ctuid) headerInfo.push(['CTU ID:', userInfo.ctuid]);
            headerInfo.push(['Export Date:', new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            })]);
            headerInfo.push(['Total Schedules:', schedules.length]);

            window.XLSX.utils.sheet_add_aoa(ws, headerInfo, { origin: `A${currentRow + 1}` });

            // Style header info
            for (let i = 0; i < headerInfo.length; i++) {
                const row = currentRow + i;
                const labelCell = window.XLSX.utils.encode_cell({ r: row, c: 0 });
                const valueCell = window.XLSX.utils.encode_cell({ r: row, c: 1 });
                
                if (!ws[labelCell]) ws[labelCell] = { t: 's', v: '' };
                if (!ws[valueCell]) ws[valueCell] = { t: 's', v: '' };
                
                ws[labelCell].s = headerLabelStyle;
                ws[valueCell].s = headerValueStyle;
            }

            currentRow += headerInfo.length + 2;

            // Build dynamic table headers based on user role
            const tableHeaders = ['Day', 'Time', 'Subject Code', 'Subject Title'];
            if (userInfo.role !== 'Teacher') {
                tableHeaders.push('Teacher');
            }
            if (userInfo.role !== 'Student') {
                tableHeaders.push('Section');
            }
            tableHeaders.push('Room', 'Type');

            window.XLSX.utils.sheet_add_aoa(ws, [tableHeaders], { origin: `A${currentRow + 1}` });

            // Style table headers
            for (let col = 0; col < tableHeaders.length; col++) {
                const cell = window.XLSX.utils.encode_cell({ r: currentRow, c: col });
                if (!ws[cell]) ws[cell] = { t: 's', v: '' };
                ws[cell].s = tableHeaderStyle;
            }

            currentRow++;

            // Add table data (dynamically based on available columns)
            const tableData = formattedData.map(row => {
                const rowData = [
                    row['Day'],
                    row['Time'],
                    row['Subject Code'],
                    row['Subject Title']
                ];
                if (userInfo.role !== 'Teacher') {
                    rowData.push(row['Teacher']);
                }
                if (userInfo.role !== 'Student') {
                    rowData.push(row['Section']);
                }
                rowData.push(row['Room'], row['Type']);
                return rowData;
            });

            window.XLSX.utils.sheet_add_aoa(ws, tableData, { origin: `A${currentRow + 1}` });

            // Style table data with alternating colors
            for (let i = 0; i < tableData.length; i++) {
                const isEven = i % 2 === 0;
                const cellStyle = isEven ? tableCellStyleEven : tableCellStyleOdd;
                
                for (let col = 0; col < tableHeaders.length; col++) {
                    const cell = window.XLSX.utils.encode_cell({ r: currentRow + i, c: col });
                    if (!ws[cell]) ws[cell] = { t: 's', v: '' };
                    ws[cell].s = cellStyle;
                }
            }

            // Set column widths dynamically based on columns
            const colWidths = [
                { wch: 14 },  // Day
                { wch: 22 },  // Time
                { wch: 16 },  // Subject Code
                { wch: 35 }   // Subject Title
            ];
            if (userInfo.role !== 'Teacher') {
                colWidths.push({ wch: 28 });  // Teacher
            }
            if (userInfo.role !== 'Student') {
                colWidths.push({ wch: 18 });  // Section
            }
            colWidths.push({ wch: 18 });  // Room
            colWidths.push({ wch: 12 });  // Type
            
            ws['!cols'] = colWidths;

            // Set row heights
            ws['!rows'] = [];
            ws['!rows'][0] = { hpt: 30 }; // Title row
            for (let i = 0; i < headerInfo.length; i++) {
                ws['!rows'][currentRow - headerInfo.length - 2 + i] = { hpt: 20 };
            }
            ws['!rows'][currentRow - 1] = { hpt: 25 }; // Header row
            for (let i = 0; i < tableData.length; i++) {
                ws['!rows'][currentRow + i] = { hpt: 20 }; // Data rows
            }

            // Add worksheet to workbook
            window.XLSX.utils.book_append_sheet(wb, ws, 'Schedule');

            // Generate filename
            const exportFilename = `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`;

            // Save file
            window.XLSX.writeFile(wb, exportFilename);

            console.log('✅ Excel export successful:', exportFilename);
            return true;
        } catch (error) {
            console.error('❌ Error exporting to Excel:', error);
            throw error;
        }
    }

    /**
     * Export schedules to PDF
     */
    /**
     * Load image as base64
     */
    async loadImageAsBase64(imagePath) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                try {
                    const dataURL = canvas.toDataURL('image/png');
                    resolve(dataURL);
                } catch (error) {
                    reject(error);
                }
            };
            img.onerror = function() {
                reject(new Error('Failed to load image'));
            };
            img.src = imagePath;
        });
    }

    async exportToPDF(schedules, filename = 'schedule', userInfo = {}) {
        try {
            await this.loadLibraries();

            if (!schedules || schedules.length === 0) {
                throw new Error('No schedules to export');
            }

            // Sort schedules
            const sortedSchedules = this.sortSchedules([...schedules]);

            // Format data
            const formattedData = this.formatScheduleData(sortedSchedules, userInfo);

            // Create PDF
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation

            // Load logos and profile picture
            let ctuLogo = null;
            let chronixLogo = null;
            let profilePicture = null;
            
            try {
                ctuLogo = await this.loadImageAsBase64('/img/img/CTU_new_logo-removebg-preview.png');
            } catch (error) {
                console.warn('Failed to load CTU logo:', error);
            }

            try {
                chronixLogo = await this.loadImageAsBase64('/img/img/CHRONIX_LOGO.png');
            } catch (error) {
                console.warn('Failed to load CHRONIX logo:', error);
            }

            // Load user profile picture if available
            if (userInfo.profilePicture) {
                try {
                    // Handle different profile picture formats
                    let picturePath = userInfo.profilePicture;
                    
                    // If it's already a base64 data URL, use it directly
                    if (picturePath.startsWith('data:image/')) {
                        profilePicture = picturePath;
                    } else {
                        // Otherwise, try to load it as an image
                        if (!picturePath.startsWith('http') && !picturePath.startsWith('/')) {
                            picturePath = '/' + picturePath;
                        }
                        profilePicture = await this.loadImageAsBase64(picturePath);
                    }
                } catch (error) {
                    console.warn('Failed to load profile picture:', error);
                }
            }

            let yPos = 15;

            // Add logos at the top
            if (ctuLogo) {
                try {
                    doc.addImage(ctuLogo, 'PNG', 14, yPos, 20, 20);
                } catch (error) {
                    console.warn('Failed to add CTU logo to PDF:', error);
                }
            }

            if (chronixLogo) {
                try {
                    doc.addImage(chronixLogo, 'PNG', 38, yPos, 20, 20);
                } catch (error) {
                    console.warn('Failed to add CHRONIX logo to PDF:', error);
                }
            }

            // Add title next to logos
            doc.setFontSize(20);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0, 45, 98); // CTU Deep Blue
            doc.text('CHRONIX - Class Schedule', 65, yPos + 10);

            // Add subtitle
            doc.setFontSize(11);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(85, 85, 85); // Dark gray
            doc.text('Cebu Technological University', 65, yPos + 16);

            yPos += 28;

            // Add horizontal line
            doc.setDrawColor(242, 210, 131); // CTU Gold
            doc.setLineWidth(0.5);
            doc.line(14, yPos, doc.internal.pageSize.getWidth() - 14, yPos);

            yPos += 8;

            // Add user information in a box
            doc.setFillColor(244, 247, 249); // Light gray background
            const infoBoxHeight = 30;
            doc.rect(14, yPos, doc.internal.pageSize.getWidth() - 28, infoBoxHeight, 'F');

            // Add border to info box
            doc.setDrawColor(224, 224, 224);
            doc.setLineWidth(0.3);
            doc.rect(14, yPos, doc.internal.pageSize.getWidth() - 28, infoBoxHeight);

            // Add profile picture if available
            if (profilePicture) {
                try {
                    // Add raw profile picture (no border, no background)
                    const picSize = 24;
                    const picX = doc.internal.pageSize.getWidth() - 40;
                    const picY = yPos + 3;
                    
                    // Add profile picture directly
                    doc.addImage(profilePicture, 'PNG', picX, picY, picSize, picSize);
                } catch (error) {
                    console.warn('Failed to add profile picture to PDF:', error);
                }
            }

            doc.setFontSize(10);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0, 45, 98); // CTU Deep Blue

            let infoYPos = yPos + 7;
            const col1X = 20;
            const col2X = 100;
            const col3X = 180;

            // Column 1
            if (userInfo.name) {
                doc.text('Name:', col1X, infoYPos);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(85, 85, 85);
                doc.text(userInfo.name, col1X + 15, infoYPos);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(0, 45, 98);
                infoYPos += 6;
            }

            if (userInfo.role) {
                doc.text('Role:', col1X, infoYPos);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(85, 85, 85);
                doc.text(userInfo.role, col1X + 15, infoYPos);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(0, 45, 98);
            }

            // Column 2
            infoYPos = yPos + 7;
            if (userInfo.section) {
                doc.text('Section:', col2X, infoYPos);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(85, 85, 85);
                doc.text(userInfo.section, col2X + 18, infoYPos);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(0, 45, 98);
                infoYPos += 6;
            }

            if (userInfo.ctuid) {
                doc.text('CTU ID:', col2X, infoYPos);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(85, 85, 85);
                doc.text(userInfo.ctuid, col2X + 18, infoYPos);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(0, 45, 98);
            }

            // Column 3
            infoYPos = yPos + 7;
            doc.text('Export Date:', col3X, infoYPos);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(85, 85, 85);
            doc.text(new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            }), col3X + 25, infoYPos);
            
            infoYPos += 6;
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0, 45, 98);
            doc.text('Total Schedules:', col3X, infoYPos);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(85, 85, 85);
            doc.text(schedules.length.toString(), col3X + 32, infoYPos);

            yPos += infoBoxHeight + 10;

            // Build dynamic table headers and data based on user role
            const pdfHeaders = ['Day', 'Time', 'Subject Code', 'Subject Title'];
            if (userInfo.role !== 'Teacher') {
                pdfHeaders.push('Teacher');
            }
            if (userInfo.role !== 'Student') {
                pdfHeaders.push('Section');
            }
            pdfHeaders.push('Room', 'Type');

            // Prepare table data dynamically
            const tableData = formattedData.map(row => {
                const rowData = [
                    row['Day'],
                    row['Time'],
                    row['Subject Code'],
                    row['Subject Title']
                ];
                if (userInfo.role !== 'Teacher') {
                    rowData.push(row['Teacher']);
                }
                if (userInfo.role !== 'Student') {
                    rowData.push(row['Section']);
                }
                rowData.push(row['Room'], row['Type']);
                return rowData;
            });

            // Build dynamic column styles
            const columnStyles = {
                0: { cellWidth: 25, halign: 'center' }, // Day
                1: { cellWidth: 35, halign: 'center' }, // Time
                2: { cellWidth: 25, halign: 'center' }, // Subject Code
                3: { cellWidth: 50, halign: 'left' }    // Subject Title
            };
            
            let colIndex = 4;
            if (userInfo.role !== 'Teacher') {
                columnStyles[colIndex] = { cellWidth: 40, halign: 'left' }; // Teacher
                colIndex++;
            }
            if (userInfo.role !== 'Student') {
                columnStyles[colIndex] = { cellWidth: 25, halign: 'center' }; // Section
                colIndex++;
            }
            columnStyles[colIndex] = { cellWidth: 25, halign: 'center' }; // Room
            columnStyles[colIndex + 1] = { cellWidth: 20, halign: 'center' }; // Type

            // Add table
            doc.autoTable({
                head: [pdfHeaders],
                body: tableData,
                startY: yPos,
                theme: 'grid',
                styles: {
                    fontSize: 8,
                    cellPadding: 3,
                    overflow: 'linebreak',
                    lineColor: [224, 224, 224],
                    lineWidth: 0.1
                },
                headStyles: {
                    fillColor: [0, 45, 98], // CTU Deep Blue
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    halign: 'center',
                    fontSize: 9,
                    cellPadding: 4
                },
                columnStyles: columnStyles,
                alternateRowStyles: {
                    fillColor: [245, 247, 249]
                },
                didDrawPage: function(data) {
                    // Add page numbers
                    const pageCount = doc.internal.getNumberOfPages();
                    doc.setFontSize(8);
                    doc.setTextColor(128);
                    doc.text(
                        `Page ${data.pageNumber} of ${pageCount}`,
                        doc.internal.pageSize.getWidth() / 2,
                        doc.internal.pageSize.getHeight() - 10,
                        { align: 'center' }
                    );
                }
            });

            // Add footer to all pages
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                
                // Footer line
                doc.setDrawColor(242, 210, 131); // CTU Gold
                doc.setLineWidth(0.3);
                doc.line(14, doc.internal.pageSize.getHeight() - 15, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 15);
                
                // Footer text
                doc.setFontSize(8);
                doc.setTextColor(128);
                doc.text(
                    'Generated by CHRONIX - CTU Class Scheduling System',
                    14,
                    doc.internal.pageSize.getHeight() - 10
                );
            }

            // Generate filename
            const exportFilename = `${filename}_${new Date().toISOString().split('T')[0]}.pdf`;

            // Save file
            doc.save(exportFilename);

            console.log('✅ PDF export successful:', exportFilename);
            return true;
        } catch (error) {
            console.error('❌ Error exporting to PDF:', error);
            throw error;
        }
    }

    /**
     * Show export options dialog
     */
    showExportDialog(schedules, userInfo = {}, filename = 'schedule') {
        return new Promise((resolve, reject) => {
            // Create modal overlay
            const overlay = document.createElement('div');
            overlay.className = 'export-modal-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(8px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                animation: fadeIn 0.3s ease;
            `;

            // Create modal content
            const modal = document.createElement('div');
            modal.className = 'export-modal-content';
            modal.style.cssText = `
                background: white;
                border-radius: 16px;
                padding: 32px;
                max-width: 400px;
                width: 90%;
                box-shadow: 0 12px 48px rgba(0,0,0,0.2);
                animation: slideUp 0.3s ease;
            `;

            modal.innerHTML = `
                <h3 style="margin: 0 0 20px 0; color: #002D62; font-size: 1.4em;">Export Schedule</h3>
                <p style="margin-bottom: 24px; color: #555;">Choose your preferred export format:</p>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <button id="exportExcelBtn" style="
                        padding: 14px 24px;
                        background: linear-gradient(135deg, #3E8EDE 0%, #2E7ECE 100%);
                        color: white;
                        border: none;
                        border-radius: 10px;
                        font-size: 1em;
                        font-weight: 600;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        transition: all 0.3s ease;
                    ">
                        <i class="bi bi-file-earmark-excel" style="font-size: 1.2em;"></i>
                        Export to Excel
                    </button>
                    <button id="exportPdfBtn" style="
                        padding: 14px 24px;
                        background: linear-gradient(135deg, #A3000C 0%, #8B0009 100%);
                        color: white;
                        border: none;
                        border-radius: 10px;
                        font-size: 1em;
                        font-weight: 600;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 10px;
                        transition: all 0.3s ease;
                    ">
                        <i class="bi bi-file-earmark-pdf" style="font-size: 1.2em;"></i>
                        Export to PDF
                    </button>
                    <button id="exportCancelBtn" style="
                        padding: 12px 24px;
                        background: #e5e8eb;
                        color: #555;
                        border: none;
                        border-radius: 10px;
                        font-size: 0.95em;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    ">
                        Cancel
                    </button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Add hover effects
            const excelBtn = modal.querySelector('#exportExcelBtn');
            const pdfBtn = modal.querySelector('#exportPdfBtn');
            const cancelBtn = modal.querySelector('#exportCancelBtn');

            excelBtn.addEventListener('mouseenter', () => {
                excelBtn.style.transform = 'translateY(-2px)';
                excelBtn.style.boxShadow = '0 6px 20px rgba(62, 142, 222, 0.4)';
            });
            excelBtn.addEventListener('mouseleave', () => {
                excelBtn.style.transform = 'translateY(0)';
                excelBtn.style.boxShadow = 'none';
            });

            pdfBtn.addEventListener('mouseenter', () => {
                pdfBtn.style.transform = 'translateY(-2px)';
                pdfBtn.style.boxShadow = '0 6px 20px rgba(163, 0, 12, 0.4)';
            });
            pdfBtn.addEventListener('mouseleave', () => {
                pdfBtn.style.transform = 'translateY(0)';
                pdfBtn.style.boxShadow = 'none';
            });

            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = '#d5d8db';
            });
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = '#e5e8eb';
            });

            // Handle button clicks
            excelBtn.addEventListener('click', async () => {
                try {
                    excelBtn.disabled = true;
                    excelBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Exporting...';
                    await this.exportToExcel(schedules, filename, userInfo);
                    document.body.removeChild(overlay);
                    resolve('excel');
                } catch (error) {
                    excelBtn.disabled = false;
                    excelBtn.innerHTML = '<i class="bi bi-file-earmark-excel"></i> Export to Excel';
                    reject(error);
                }
            });

            pdfBtn.addEventListener('click', async () => {
                try {
                    pdfBtn.disabled = true;
                    pdfBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Exporting...';
                    await this.exportToPDF(schedules, filename, userInfo);
                    document.body.removeChild(overlay);
                    resolve('pdf');
                } catch (error) {
                    pdfBtn.disabled = false;
                    pdfBtn.innerHTML = '<i class="bi bi-file-earmark-pdf"></i> Export to PDF';
                    reject(error);
                }
            });

            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(overlay);
                resolve(null);
            });

            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                    resolve(null);
                }
            });
        });
    }
}

// Export as singleton
const scheduleExporter = new ScheduleExporter();
export default scheduleExporter;
