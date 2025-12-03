// dashboard-pdf-export.js
// Professional PDF Export System for Admin Dashboard
// Clean, Minimal, Modern Design - No Emojis

/**
 * PDF Export Manager
 * Creates beautiful, branded PDF reports for different data types
 */
class DashboardPDFExporter {
    constructor() {
        this.colors = {
            primary: [0, 45, 98],        // CTU Deep Blue
            secondary: [242, 210, 131],   // CTU Soft Gold
            accent: [62, 142, 222],       // CTU Light Blue
            success: [75, 181, 67],
            warning: [255, 152, 0],
            danger: [216, 0, 12],
            text: [51, 51, 51],
            textLight: [100, 100, 100],
            background: [248, 250, 252],
            purple: [139, 92, 246],
            orange: [255, 104, 53],
            white: [255, 255, 255],
            lightGray: [240, 240, 240]
        };
        
        this.initializeHelpers();
    }
    
    initializeHelpers() {
        if (typeof window.jspdf !== 'undefined') {
            const { jsPDF } = window.jspdf;
            jsPDF.API.triangle = function(x1, y1, x2, y2, x3, y3, style) {
                this.lines([[x2 - x1, y2 - y1], [x3 - x2, y3 - y2], [x1 - x3, y1 - y3]], x1, y1, [1, 1], style || 'F');
                return this;
            };
        }
    }

    /**
     * Show export dialog
     */
    async showExportDialog(dashboardData) {
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.className = 'export-dialog-overlay';
            dialog.innerHTML = `
                <div class="export-dialog">
                    <div class="export-dialog-header">
                        <h3><i class="bi bi-file-earmark-pdf"></i> Export Dashboard Data</h3>
                        <button class="export-dialog-close" aria-label="Close">
                            <i class="bi bi-x-lg"></i>
                        </button>
                    </div>
                    <div class="export-dialog-body">
                        <p>Choose what data to export as PDF:</p>
                        <div class="export-options">
                            <button class="export-option" data-type="complete">
                                <i class="bi bi-file-earmark-text"></i>
                                <div>
                                    <strong>Complete Dashboard Report</strong>
                                    <span>All data with statistics</span>
                                </div>
                            </button>
                            <button class="export-option" data-type="students">
                                <i class="bi bi-mortarboard"></i>
                                <div>
                                    <strong>Students Report</strong>
                                    <span>Student list with details</span>
                                </div>
                            </button>
                            <button class="export-option" data-type="teachers">
                                <i class="bi bi-person-badge"></i>
                                <div>
                                    <strong>Teachers Report</strong>
                                    <span>Faculty list with assignments</span>
                                </div>
                            </button>
                            <button class="export-option" data-type="rooms">
                                <i class="bi bi-door-open"></i>
                                <div>
                                    <strong>Rooms Report</strong>
                                    <span>Room inventory and status</span>
                                </div>
                            </button>
                            <button class="export-option" data-type="schedules">
                                <i class="bi bi-calendar-event"></i>
                                <div>
                                    <strong>Schedules Report</strong>
                                    <span>Complete schedule overview</span>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(dialog);
            setTimeout(() => dialog.classList.add('show'), 10);

            dialog.querySelectorAll('.export-option').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const type = btn.dataset.type;
                    dialog.classList.remove('show');
                    setTimeout(() => dialog.remove(), 300);
                    
                    this.showLoadingOverlay();
                    
                    try {
                        await this.generatePDF(type, dashboardData);
                        resolve(type);
                    } catch (error) {
                        console.error('PDF generation error:', error);
                        alert('Failed to generate PDF. Please try again.');
                        resolve(null);
                    } finally {
                        this.hideLoadingOverlay();
                    }
                });
            });

            const closeBtn = dialog.querySelector('.export-dialog-close');
            closeBtn.addEventListener('click', () => {
                dialog.classList.remove('show');
                setTimeout(() => dialog.remove(), 300);
                resolve(null);
            });

            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    dialog.classList.remove('show');
                    setTimeout(() => dialog.remove(), 300);
                    resolve(null);
                }
            });
        });
    }

    async generatePDF(type, data) {
        switch (type) {
            case 'complete':
                return this.generateCompleteDashboardPDF(data);
            case 'students':
                return this.generateStudentsPDF(data);
            case 'teachers':
                return this.generateTeachersPDF(data);
            case 'rooms':
                return this.generateRoomsPDF(data);
            case 'schedules':
                return this.generateSchedulesPDF(data);
            default:
                throw new Error('Invalid export type');
        }
    }

    /**
     * Generate Complete Dashboard PDF
     */
    async generateCompleteDashboardPDF(data) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        // Page 1: Clean Cover Page
        this.addCoverPage(doc, 'Dashboard Report', data);
        
        // Page 2: Executive Summary with Stats
        doc.addPage();
        this.addExecutiveSummaryPage(doc, data);

        // Page 3: Students Overview
        doc.addPage();
        let yPos = 20;
        this.addSectionHeader(doc, 'Students Overview', yPos);
        yPos += 15;
        this.addStudentsSection(doc, data.students, data.sections, yPos);

        // Page 4: Teachers Overview
        doc.addPage();
        yPos = 20;
        this.addSectionHeader(doc, 'Teachers Overview', yPos);
        yPos += 15;
        this.addTeachersSection(doc, data.teachers, data.schedules, data.subjects, yPos);

        // Page 5: Rooms Overview
        doc.addPage();
        yPos = 20;
        this.addSectionHeader(doc, 'Rooms Overview', yPos);
        yPos += 15;
        this.addRoomsSection(doc, data.rooms, yPos);

        // Page 6: Schedules Overview
        doc.addPage();
        yPos = 20;
        this.addSectionHeader(doc, 'Schedules Overview', yPos);
        yPos += 15;
        this.addSchedulesSection(doc, data, yPos);

        this.addFooterToAllPages(doc);
        doc.save(`CHRONIX_Dashboard_Report_${this.getDateString()}.pdf`);
    }


    /**
     * CLEAN MINIMAL COVER PAGE
     * Professional, simple design without emojis
     */
    addCoverPage(doc, title, data) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const centerX = pageWidth / 2;

        // Clean white background
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');

        // Top accent bar - Deep Blue
        doc.setFillColor(...this.colors.primary);
        doc.rect(0, 0, pageWidth, 50, 'F');

        // Gold accent line below blue bar
        doc.setFillColor(...this.colors.secondary);
        doc.rect(0, 50, pageWidth, 3, 'F');

        // University name in header
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text('Cebu Technological University', centerX, 20, { align: 'center' });

        // CHRONIX title
        doc.setFontSize(32);
        doc.setFont('helvetica', 'bold');
        doc.text('CHRONIX', centerX, 38, { align: 'center' });

        // Main Report Title
        doc.setTextColor(...this.colors.primary);
        doc.setFontSize(28);
        doc.setFont('helvetica', 'bold');
        doc.text(title.toUpperCase(), centerX, 90, { align: 'center' });

        // Decorative line under title
        doc.setDrawColor(...this.colors.secondary);
        doc.setLineWidth(1.5);
        doc.line(centerX - 40, 98, centerX + 40, 98);

        // Academic Year
        const currentDate = new Date();
        const academicYear = `Academic Year ${currentDate.getFullYear()}-${currentDate.getFullYear() + 1}`;
        doc.setTextColor(...this.colors.textLight);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(academicYear, centerX, 115, { align: 'center' });

        // Quick Stats Box (if data provided)
        if (data) {
            const boxY = 140;
            const boxWidth = 140;
            const boxHeight = 70;
            const boxX = centerX - boxWidth / 2;

            // Stats box background
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 4, 4, 'F');

            // Stats box border
            doc.setDrawColor(...this.colors.accent);
            doc.setLineWidth(0.5);
            doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 4, 4, 'S');

            // Stats title
            doc.setTextColor(...this.colors.primary);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('QUICK OVERVIEW', centerX, boxY + 12, { align: 'center' });

            // Stats grid
            const stats = [
                { label: 'Students', value: data.students?.length || 0 },
                { label: 'Teachers', value: data.teachers?.length || 0 },
                { label: 'Rooms', value: data.rooms?.length || 0 },
                { label: 'Schedules', value: data.schedules?.length || 0 }
            ];

            const statWidth = boxWidth / 2;
            stats.forEach((stat, index) => {
                const col = index % 2;
                const row = Math.floor(index / 2);
                const statX = boxX + col * statWidth + statWidth / 2;
                const statY = boxY + 28 + row * 22;

                // Value
                doc.setTextColor(...this.colors.primary);
                doc.setFontSize(18);
                doc.setFont('helvetica', 'bold');
                doc.text(stat.value.toString(), statX, statY, { align: 'center' });

                // Label
                doc.setTextColor(...this.colors.textLight);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.text(stat.label, statX, statY + 8, { align: 'center' });
            });
        }

        // Bottom section
        // Gold bar at bottom
        doc.setFillColor(...this.colors.secondary);
        doc.rect(0, pageHeight - 30, pageWidth, 30, 'F');

        // Generation date
        doc.setTextColor(...this.colors.primary);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const generatedDate = currentDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        doc.text(`Generated: ${generatedDate}`, centerX, pageHeight - 18, { align: 'center' });

        // System name
        doc.setFontSize(8);
        doc.text('Academic Management System', centerX, pageHeight - 10, { align: 'center' });
    }

    /**
     * EXECUTIVE SUMMARY PAGE
     * Clean stats and data overview
     */
    addExecutiveSummaryPage(doc, data) {
        const pageWidth = doc.internal.pageSize.getWidth();
        
        // Page header
        doc.setFillColor(...this.colors.primary);
        doc.rect(0, 0, pageWidth, 25, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('Executive Summary', 20, 16);

        // Date on right
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const currentDate = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        doc.text(currentDate, pageWidth - 20, 16, { align: 'right' });

        // Calculate metrics
        const totalStudents = data.students?.length || 0;
        const totalTeachers = data.teachers?.length || 0;
        const totalRooms = data.rooms?.length || 0;
        const availableRooms = data.rooms?.filter(r => r.status === 'Available').length || 0;
        const occupiedRooms = data.rooms?.filter(r => r.status === 'Occupied').length || 0;
        const activeSchedules = data.schedules?.length || 0;

        // KPI Cards
        let yPos = 40;
        const cardWidth = 82;
        const cardHeight = 35;
        const cardSpacing = 8;

        const kpis = [
            { label: 'Total Students', value: totalStudents, color: this.colors.accent },
            { label: 'Total Teachers', value: totalTeachers, color: this.colors.orange },
            { label: 'Total Rooms', value: totalRooms, color: this.colors.success },
            { label: 'Active Schedules', value: activeSchedules, color: this.colors.purple }
        ];

        kpis.forEach((kpi, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const x = 20 + col * (cardWidth + cardSpacing);
            const y = yPos + row * (cardHeight + cardSpacing);

            // Card background
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'F');

            // Card border
            doc.setDrawColor(230, 230, 230);
            doc.setLineWidth(0.3);
            doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'S');

            // Left accent bar
            doc.setFillColor(...kpi.color);
            doc.rect(x, y, 3, cardHeight, 'F');

            // Value
            doc.setTextColor(...kpi.color);
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text(kpi.value.toString(), x + 12, y + 18);

            // Label
            doc.setTextColor(...this.colors.text);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.text(kpi.label, x + 12, y + 28);
        });

        yPos += (cardHeight + cardSpacing) * 2 + 15;

        // Key Insights Section
        doc.setTextColor(...this.colors.primary);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Key Insights', 20, yPos);
        yPos += 8;

        // Insights box
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(20, yPos, pageWidth - 40, 45, 3, 3, 'F');

        const roomUtilization = totalRooms > 0 ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : 0;
        const avgLoad = totalTeachers > 0 ? (activeSchedules / totalTeachers).toFixed(1) : 0;
        const ratio = totalTeachers > 0 ? (totalStudents / totalTeachers).toFixed(1) : 0;

        const insights = [
            `Room Utilization: ${roomUtilization}% (${occupiedRooms} of ${totalRooms} rooms in use)`,
            `Average Teaching Load: ${avgLoad} classes per teacher`,
            `Student-Teacher Ratio: ${ratio}:1`,
            `Available Rooms: ${availableRooms} rooms ready for scheduling`
        ];

        doc.setTextColor(...this.colors.text);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        insights.forEach((insight, index) => {
            doc.text('•  ' + insight, 28, yPos + 10 + index * 10);
        });

        yPos += 60;

        // Detailed Statistics Table
        doc.setTextColor(...this.colors.primary);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Detailed Statistics', 20, yPos);
        yPos += 8;

        // Year level breakdown
        const yearLevels = { '1': 0, '2': 0, '3': 0, '4': 0 };
        data.students?.forEach(student => {
            const section = data.sections?.find(s => s._id === student.section);
            if (section && yearLevels.hasOwnProperty(section.yearLevel)) {
                yearLevels[section.yearLevel]++;
            }
        });

        const tableData = [
            ['Students - Year 1', yearLevels['1'].toString(), totalStudents > 0 ? ((yearLevels['1'] / totalStudents) * 100).toFixed(1) + '%' : '0%'],
            ['Students - Year 2', yearLevels['2'].toString(), totalStudents > 0 ? ((yearLevels['2'] / totalStudents) * 100).toFixed(1) + '%' : '0%'],
            ['Students - Year 3', yearLevels['3'].toString(), totalStudents > 0 ? ((yearLevels['3'] / totalStudents) * 100).toFixed(1) + '%' : '0%'],
            ['Students - Year 4', yearLevels['4'].toString(), totalStudents > 0 ? ((yearLevels['4'] / totalStudents) * 100).toFixed(1) + '%' : '0%'],
            ['Rooms - Available', availableRooms.toString(), totalRooms > 0 ? ((availableRooms / totalRooms) * 100).toFixed(1) + '%' : '0%'],
            ['Rooms - Occupied', occupiedRooms.toString(), totalRooms > 0 ? ((occupiedRooms / totalRooms) * 100).toFixed(1) + '%' : '0%']
        ];

        doc.autoTable({
            startY: yPos,
            head: [['Category', 'Count', 'Percentage']],
            body: tableData,
            theme: 'striped',
            headStyles: {
                fillColor: this.colors.primary,
                textColor: 255,
                fontSize: 9,
                fontStyle: 'bold',
                halign: 'center'
            },
            styles: {
                fontSize: 9,
                cellPadding: 4
            },
            alternateRowStyles: {
                fillColor: [248, 250, 252]
            },
            columnStyles: {
                0: { fontStyle: 'bold' },
                1: { halign: 'center' },
                2: { halign: 'center' }
            },
            margin: { left: 20, right: 20 }
        });
    }


    /**
     * Section Header - Clean Design
     */
    addSectionHeader(doc, title, yPos) {
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header background
        doc.setFillColor(...this.colors.primary);
        doc.roundedRect(15, yPos - 5, pageWidth - 30, 12, 2, 2, 'F');

        // Gold accent on left
        doc.setFillColor(...this.colors.secondary);
        doc.rect(15, yPos - 5, 4, 12, 'F');

        // Title text
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 24, yPos + 3);

        doc.setTextColor(...this.colors.text);
        doc.setFont('helvetica', 'normal');
    }

    /**
     * Students Section
     */
    addStudentsSection(doc, students, sections, yPos) {
        const yearLevels = {};
        students?.forEach(student => {
            const section = sections?.find(s => s._id === student.section);
            if (section) {
                yearLevels[section.yearLevel] = (yearLevels[section.yearLevel] || 0) + 1;
            }
        });

        const stats = [
            ['Total Students', (students?.length || 0).toString()],
            ['Year 1 Students', (yearLevels['1'] || 0).toString()],
            ['Year 2 Students', (yearLevels['2'] || 0).toString()],
            ['Year 3 Students', (yearLevels['3'] || 0).toString()],
            ['Year 4 Students', (yearLevels['4'] || 0).toString()]
        ];

        doc.autoTable({
            startY: yPos,
            head: [['Category', 'Count']],
            body: stats,
            theme: 'striped',
            headStyles: {
                fillColor: this.colors.accent,
                textColor: 255,
                fontSize: 10,
                fontStyle: 'bold'
            },
            styles: { fontSize: 9, cellPadding: 4 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { fontStyle: 'bold' },
                1: { halign: 'center', textColor: this.colors.accent }
            },
            margin: { left: 20, right: 20 }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // Student list (first 20)
        if (students && students.length > 0) {
            doc.setTextColor(...this.colors.primary);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('Student List (Sample)', 20, yPos);
            yPos += 8;

            const studentData = students.slice(0, 20).map(student => {
                const section = sections?.find(s => s._id === student.section);
                return [
                    student.ctuid || 'N/A',
                    student.fullname || 'N/A',
                    student.email || 'N/A',
                    section ? section.name : 'N/A'
                ];
            });

            doc.autoTable({
                startY: yPos,
                head: [['CTU ID', 'Full Name', 'Email', 'Section']],
                body: studentData,
                theme: 'grid',
                headStyles: {
                    fillColor: this.colors.accent,
                    textColor: 255,
                    fontSize: 8,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                styles: { fontSize: 7, cellPadding: 3 },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                margin: { left: 15, right: 15 }
            });
        }
    }

    /**
     * Teachers Section
     */
    addTeachersSection(doc, teachers, schedules, subjects, yPos) {
        const stats = [
            ['Total Faculty Members', (teachers?.length || 0).toString()],
            ['Active Schedules', (schedules?.length || 0).toString()],
            ['Average Load', ((schedules?.length || 0) / Math.max(teachers?.length || 1, 1)).toFixed(1) + ' classes/teacher']
        ];

        doc.autoTable({
            startY: yPos,
            head: [['Metric', 'Value']],
            body: stats,
            theme: 'striped',
            headStyles: {
                fillColor: this.colors.orange,
                textColor: 255,
                fontSize: 10,
                fontStyle: 'bold'
            },
            styles: { fontSize: 9, cellPadding: 4 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { fontStyle: 'bold' },
                1: { halign: 'center', textColor: this.colors.orange }
            },
            margin: { left: 20, right: 20 }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // Teacher list
        if (teachers && teachers.length > 0) {
            doc.setTextColor(...this.colors.primary);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('Faculty Directory', 20, yPos);
            yPos += 8;

            const teacherData = teachers.slice(0, 15).map(teacher => {
                const teacherSchedules = schedules?.filter(s => s.teacher === teacher._id) || [];
                return [
                    teacher.fullname || 'N/A',
                    teacher.email || 'N/A',
                    teacherSchedules.length.toString()
                ];
            });

            doc.autoTable({
                startY: yPos,
                head: [['Full Name', 'Email', 'Classes']],
                body: teacherData,
                theme: 'grid',
                headStyles: {
                    fillColor: this.colors.orange,
                    textColor: 255,
                    fontSize: 8,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                styles: { fontSize: 7, cellPadding: 3 },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                columnStyles: {
                    2: { halign: 'center', fontStyle: 'bold' }
                },
                margin: { left: 15, right: 15 }
            });
        }
    }

    /**
     * Rooms Section
     */
    addRoomsSection(doc, rooms, yPos) {
        const available = rooms?.filter(r => r.status === 'Available').length || 0;
        const occupied = rooms?.filter(r => r.status === 'Occupied').length || 0;
        const maintenance = rooms?.filter(r => r.status === 'Maintenance').length || 0;
        const total = rooms?.length || 0;

        const stats = [
            ['Total Rooms', total.toString()],
            ['Available', available.toString()],
            ['Occupied', occupied.toString()],
            ['Under Maintenance', maintenance.toString()],
            ['Utilization Rate', total > 0 ? ((occupied / total) * 100).toFixed(1) + '%' : '0%']
        ];

        doc.autoTable({
            startY: yPos,
            head: [['Category', 'Count']],
            body: stats,
            theme: 'striped',
            headStyles: {
                fillColor: this.colors.success,
                textColor: 255,
                fontSize: 10,
                fontStyle: 'bold'
            },
            styles: { fontSize: 9, cellPadding: 4 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { fontStyle: 'bold' },
                1: { halign: 'center', textColor: this.colors.success }
            },
            margin: { left: 20, right: 20 }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // Room list
        if (rooms && rooms.length > 0) {
            doc.setTextColor(...this.colors.primary);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('Room Inventory', 20, yPos);
            yPos += 8;

            const roomData = rooms.slice(0, 15).map(room => [
                room.name || 'N/A',
                room.building || 'N/A',
                room.type || 'N/A',
                room.capacity?.toString() || 'N/A',
                room.status || 'N/A'
            ]);

            doc.autoTable({
                startY: yPos,
                head: [['Room', 'Building', 'Type', 'Capacity', 'Status']],
                body: roomData,
                theme: 'grid',
                headStyles: {
                    fillColor: this.colors.success,
                    textColor: 255,
                    fontSize: 8,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                styles: { fontSize: 7, cellPadding: 3 },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                columnStyles: {
                    3: { halign: 'center' },
                    4: { halign: 'center' }
                },
                margin: { left: 15, right: 15 },
                didParseCell: (data) => {
                    if (data.column.index === 4 && data.cell.section === 'body') {
                        const status = data.cell.raw;
                        if (status === 'Available') {
                            data.cell.styles.textColor = this.colors.success;
                            data.cell.styles.fontStyle = 'bold';
                        } else if (status === 'Occupied') {
                            data.cell.styles.textColor = this.colors.warning;
                            data.cell.styles.fontStyle = 'bold';
                        } else if (status === 'Maintenance') {
                            data.cell.styles.textColor = this.colors.danger;
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                }
            });
        }
    }

    /**
     * Schedules Section
     */
    addSchedulesSection(doc, data, yPos) {
        const schedules = data.schedules || [];
        const days = {};
        schedules.forEach(schedule => {
            days[schedule.day] = (days[schedule.day] || 0) + 1;
        });

        const busiestDay = Object.keys(days).reduce((a, b) => (days[a] > days[b] ? a : b), 'N/A');

        const stats = [
            ['Total Schedules', schedules.length.toString()],
            ['Busiest Day', busiestDay],
            ['Unique Days', Object.keys(days).length.toString()]
        ];

        doc.autoTable({
            startY: yPos,
            head: [['Metric', 'Value']],
            body: stats,
            theme: 'striped',
            headStyles: {
                fillColor: this.colors.purple,
                textColor: 255,
                fontSize: 10,
                fontStyle: 'bold'
            },
            styles: { fontSize: 9, cellPadding: 4 },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { fontStyle: 'bold' },
                1: { halign: 'center', textColor: this.colors.purple }
            },
            margin: { left: 20, right: 20 }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // Schedule list
        if (schedules.length > 0) {
            doc.setTextColor(...this.colors.primary);
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text('Schedule List (Sample)', 20, yPos);
            yPos += 8;

            const scheduleData = schedules.slice(0, 15).map(schedule => {
                const subject = data.subjects?.find(s => s._id === schedule.subject);
                const teacher = data.teachers?.find(t => t._id === schedule.teacher);
                const section = data.sections?.find(s => s._id === schedule.section);
                const room = data.rooms?.find(r => r._id === schedule.room);

                return [
                    subject?.code || 'N/A',
                    teacher?.fullname || 'N/A',
                    section?.name || 'N/A',
                    room?.name || 'N/A',
                    schedule.day || 'N/A',
                    `${schedule.startTime || ''} - ${schedule.endTime || ''}`
                ];
            });

            doc.autoTable({
                startY: yPos,
                head: [['Subject', 'Teacher', 'Section', 'Room', 'Day', 'Time']],
                body: scheduleData,
                theme: 'grid',
                headStyles: {
                    fillColor: this.colors.purple,
                    textColor: 255,
                    fontSize: 7,
                    fontStyle: 'bold',
                    halign: 'center'
                },
                styles: { fontSize: 6.5, cellPadding: 2 },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                margin: { left: 15, right: 15 }
            });
        }
    }


    /**
     * Generate Students PDF
     */
    async generateStudentsPDF(data) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        this.addCoverPage(doc, 'Students Report', data);
        doc.addPage();

        let yPos = 20;
        this.addSectionHeader(doc, 'Student Statistics', yPos);
        yPos += 15;
        this.addStudentsSection(doc, data.students, data.sections, yPos);

        this.addFooterToAllPages(doc);
        doc.save(`CHRONIX_Students_Report_${this.getDateString()}.pdf`);
    }

    /**
     * Generate Teachers PDF
     */
    async generateTeachersPDF(data) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        this.addCoverPage(doc, 'Teachers Report', data);
        doc.addPage();

        let yPos = 20;
        this.addSectionHeader(doc, 'Faculty Overview', yPos);
        yPos += 15;
        this.addTeachersSection(doc, data.teachers, data.schedules, data.subjects, yPos);

        this.addFooterToAllPages(doc);
        doc.save(`CHRONIX_Teachers_Report_${this.getDateString()}.pdf`);
    }

    /**
     * Generate Rooms PDF
     */
    async generateRoomsPDF(data) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        this.addCoverPage(doc, 'Rooms Report', data);
        doc.addPage();

        let yPos = 20;
        this.addSectionHeader(doc, 'Room Inventory', yPos);
        yPos += 15;
        this.addRoomsSection(doc, data.rooms, yPos);

        this.addFooterToAllPages(doc);
        doc.save(`CHRONIX_Rooms_Report_${this.getDateString()}.pdf`);
    }

    /**
     * Generate Schedules PDF
     */
    async generateSchedulesPDF(data) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape

        this.addCoverPage(doc, 'Schedules Report', data);
        doc.addPage();

        let yPos = 20;
        this.addSectionHeader(doc, 'Schedule Overview', yPos);
        yPos += 15;
        this.addSchedulesSection(doc, data, yPos);

        this.addFooterToAllPages(doc);
        doc.save(`CHRONIX_Schedules_Report_${this.getDateString()}.pdf`);
    }

    /**
     * Footer for all pages
     */
    addFooterToAllPages(doc) {
        const pageCount = doc.internal.getNumberOfPages();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);

            // Footer line
            doc.setDrawColor(...this.colors.lightGray);
            doc.setLineWidth(0.5);
            doc.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);

            // Page number
            doc.setTextColor(...this.colors.textLight);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });

            // CHRONIX branding
            doc.setTextColor(...this.colors.primary);
            doc.setFont('helvetica', 'bold');
            doc.text('CHRONIX', 15, pageHeight - 8);

            // System name
            doc.setTextColor(...this.colors.textLight);
            doc.setFont('helvetica', 'normal');
            doc.text('CTU Academic Management System', pageWidth - 15, pageHeight - 8, { align: 'right' });
        }
    }

    /**
     * Get formatted date string
     */
    getDateString() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    /**
     * Show loading overlay
     */
    showLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'pdfLoadingOverlay';
        overlay.className = 'pdf-loading-overlay';
        overlay.innerHTML = `
            <div class="pdf-loading-content">
                <div class="pdf-loading-spinner"></div>
                <p>Generating PDF...</p>
                <small>This may take a moment</small>
            </div>
        `;
        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add('show'), 10);
    }

    /**
     * Hide loading overlay
     */
    hideLoadingOverlay() {
        const overlay = document.getElementById('pdfLoadingOverlay');
        if (overlay) {
            overlay.classList.remove('show');
            setTimeout(() => overlay.remove(), 300);
        }
    }
}

// Export singleton instance
export default new DashboardPDFExporter();
