// dashboard-pdf-export.js
// Professional PDF Export System for Admin Dashboard
// Uses jsPDF and jsPDF-AutoTable for beautiful, branded PDF reports

// jsPDF will be loaded from CDN in HTML

/**
 * PDF Export Manager
 * Creates beautiful, branded PDF reports for different data types
 */
class DashboardPDFExporter {
    constructor() {
        this.colors = {
            primary: [0, 45, 98],      // CTU Deep Blue
            secondary: [242, 210, 131], // CTU Soft Gold
            accent: [62, 142, 222],     // CTU Light Blue
            success: [75, 181, 67],
            warning: [255, 152, 0],
            danger: [216, 0, 12],
            text: [51, 51, 51],
            textLight: [85, 85, 85],
            background: [244, 247, 249]
        };
    }

    /**
     * Show export dialog to choose what to export
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
                                    <span>All data with charts and statistics</span>
                                </div>
                            </button>
                            <button class="export-option" data-type="students">
                                <i class="bi bi-mortarboard"></i>
                                <div>
                                    <strong>Students Report</strong>
                                    <span>Student list with details and analytics</span>
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
                                    <span>Room inventory and utilization</span>
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

            // Handle option selection
            dialog.querySelectorAll('.export-option').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const type = btn.dataset.type;
                    dialog.classList.remove('show');
                    setTimeout(() => dialog.remove(), 300);
                    
                    // Show loading
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

            // Handle close
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

    /**
     * Generate PDF based on type
     */
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
        let yPos = 20;

        // Cover Page
        this.addCoverPage(doc, 'Complete Dashboard Report');
        doc.addPage();
        yPos = 20;

        // Executive Summary
        this.addSectionHeader(doc, 'Executive Summary', yPos);
        yPos += 15;

        const summary = [
            ['Total Students', data.students.length.toString()],
            ['Total Teachers', data.teachers.length.toString()],
            ['Total Rooms', data.rooms.length.toString()],
            ['Active Schedules', data.schedules.length.toString()],
            ['Available Rooms', data.rooms.filter(r => r.status === 'Available').length.toString()]
        ];

        doc.autoTable({
            startY: yPos,
            head: [['Metric', 'Value']],
            body: summary,
            theme: 'grid',
            headStyles: { fillColor: this.colors.primary, textColor: 255 },
            styles: { fontSize: 11 },
            margin: { left: 20, right: 20 }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // Students Overview
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        this.addSectionHeader(doc, 'Students Overview', yPos);
        yPos += 10;
        this.addStudentsSection(doc, data.students, data.sections, yPos);

        // Teachers Overview
        doc.addPage();
        yPos = 20;
        this.addSectionHeader(doc, 'Teachers Overview', yPos);
        yPos += 10;
        this.addTeachersSection(doc, data.teachers, yPos);

        // Rooms Overview
        doc.addPage();
        yPos = 20;
        this.addSectionHeader(doc, 'Rooms Overview', yPos);
        yPos += 10;
        this.addRoomsSection(doc, data.rooms, yPos);

        // Footer on all pages
        this.addFooterToAllPages(doc);

        // Save
        doc.save(`CHRONIX_Complete_Dashboard_${this.getDateString()}.pdf`);
    }

    /**
     * Generate Students PDF
     */
    async generateStudentsPDF(data) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        
        // Cover Page
        this.addCoverPage(doc, 'Students Report');
        doc.addPage();

        let yPos = 20;
        this.addSectionHeader(doc, 'Student Statistics', yPos);
        yPos += 15;

        // Statistics
        const yearLevels = {};
        const sections = {};
        data.students.forEach(student => {
            const section = data.sections.find(s => s._id === student.section);
            if (section) {
                yearLevels[section.yearLevel] = (yearLevels[section.yearLevel] || 0) + 1;
                sections[section.name] = (sections[section.name] || 0) + 1;
            }
        });

        const stats = [
            ['Total Students', data.students.length.toString()],
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
            headStyles: { fillColor: this.colors.primary },
            styles: { fontSize: 10 },
            margin: { left: 20, right: 20 }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // Student List
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        this.addSectionHeader(doc, 'Complete Student List', yPos);
        yPos += 10;

        const studentData = data.students.map(student => {
            const section = data.sections.find(s => s._id === student.section);
            return [
                student.ctuid || 'N/A',
                student.fullname || 'N/A',
                student.email || 'N/A',
                section ? `${section.name} (Year ${section.yearLevel})` : 'N/A'
            ];
        });

        doc.autoTable({
            startY: yPos,
            head: [['CTU ID', 'Full Name', 'Email', 'Section']],
            body: studentData,
            theme: 'grid',
            headStyles: { fillColor: this.colors.accent, fontSize: 9 },
            styles: { fontSize: 8, cellPadding: 3 },
            margin: { left: 15, right: 15 },
            columnStyles: {
                0: { cellWidth: 30 },
                1: { cellWidth: 50 },
                2: { cellWidth: 60 },
                3: { cellWidth: 45 }
            }
        });

        this.addFooterToAllPages(doc);
        doc.save(`CHRONIX_Students_Report_${this.getDateString()}.pdf`);
    }

    /**
     * Generate Teachers PDF
     */
    async generateTeachersPDF(data) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        
        // Cover Page
        this.addCoverPage(doc, 'Teachers Report');
        doc.addPage();

        let yPos = 20;
        this.addSectionHeader(doc, 'Faculty Overview', yPos);
        yPos += 15;

        // Statistics
        const stats = [
            ['Total Faculty Members', data.teachers.length.toString()],
            ['Active Schedules', data.schedules.length.toString()],
            ['Average Load', (data.schedules.length / Math.max(data.teachers.length, 1)).toFixed(1) + ' classes/teacher']
        ];

        doc.autoTable({
            startY: yPos,
            head: [['Metric', 'Value']],
            body: stats,
            theme: 'striped',
            headStyles: { fillColor: this.colors.primary },
            margin: { left: 20, right: 20 }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // Teacher List with Assignments
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        this.addSectionHeader(doc, 'Faculty Directory', yPos);
        yPos += 10;

        const teacherData = data.teachers.map(teacher => {
            const teacherSchedules = data.schedules.filter(s => s.teacher === teacher._id);
            const subjects = [...new Set(teacherSchedules.map(s => {
                const subject = data.subjects?.find(sub => sub._id === s.subject);
                return subject ? subject.code : 'N/A';
            }))].join(', ');

            return [
                teacher.fullname || 'N/A',
                teacher.email || 'N/A',
                teacherSchedules.length.toString(),
                subjects || 'No assignments'
            ];
        });

        doc.autoTable({
            startY: yPos,
            head: [['Full Name', 'Email', 'Classes', 'Subjects']],
            body: teacherData,
            theme: 'grid',
            headStyles: { fillColor: [255, 104, 53], fontSize: 9 },
            styles: { fontSize: 8, cellPadding: 3 },
            margin: { left: 15, right: 15 },
            columnStyles: {
                0: { cellWidth: 45 },
                1: { cellWidth: 55 },
                2: { cellWidth: 20 },
                3: { cellWidth: 65 }
            }
        });

        this.addFooterToAllPages(doc);
        doc.save(`CHRONIX_Teachers_Report_${this.getDateString()}.pdf`);
    }

    /**
     * Generate Rooms PDF
     */
    async generateRoomsPDF(data) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        
        // Cover Page
        this.addCoverPage(doc, 'Rooms & Facilities Report');
        doc.addPage();

        let yPos = 20;
        this.addSectionHeader(doc, 'Room Inventory', yPos);
        yPos += 15;

        // Statistics
        const available = data.rooms.filter(r => r.status === 'Available').length;
        const occupied = data.rooms.filter(r => r.status === 'Occupied').length;
        const maintenance = data.rooms.filter(r => r.status === 'Maintenance').length;

        const stats = [
            ['Total Rooms', data.rooms.length.toString()],
            ['Available', available.toString()],
            ['Occupied', occupied.toString()],
            ['Under Maintenance', maintenance.toString()],
            ['Utilization Rate', ((occupied / data.rooms.length) * 100).toFixed(1) + '%']
        ];

        doc.autoTable({
            startY: yPos,
            head: [['Category', 'Count']],
            body: stats,
            theme: 'striped',
            headStyles: { fillColor: this.colors.success },
            margin: { left: 20, right: 20 }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // Room List
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        this.addSectionHeader(doc, 'Complete Room List', yPos);
        yPos += 10;

        const roomData = data.rooms.map(room => [
            room.name || 'N/A',
            room.building || 'N/A',
            room.type || 'N/A',
            room.capacity?.toString() || 'N/A',
            room.status || 'N/A'
        ]);

        doc.autoTable({
            startY: yPos,
            head: [['Room Name', 'Building', 'Type', 'Capacity', 'Status']],
            body: roomData,
            theme: 'grid',
            headStyles: { fillColor: this.colors.success, fontSize: 9 },
            styles: { fontSize: 8, cellPadding: 3 },
            margin: { left: 15, right: 15 },
            columnStyles: {
                0: { cellWidth: 35 },
                1: { cellWidth: 40 },
                2: { cellWidth: 35 },
                3: { cellWidth: 25 },
                4: { cellWidth: 30 }
            },
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

        this.addFooterToAllPages(doc);
        doc.save(`CHRONIX_Rooms_Report_${this.getDateString()}.pdf`);
    }

    /**
     * Generate Schedules PDF
     */
    async generateSchedulesPDF(data) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape for schedules
        
        // Cover Page
        this.addCoverPage(doc, 'Schedules Report');
        doc.addPage();

        let yPos = 20;
        this.addSectionHeader(doc, 'Schedule Overview', yPos);
        yPos += 15;

        // Statistics
        const days = {};
        const shifts = {};
        data.schedules.forEach(schedule => {
            days[schedule.day] = (days[schedule.day] || 0) + 1;
            const section = data.sections?.find(s => s._id === schedule.section);
            if (section) {
                shifts[section.shift] = (shifts[section.shift] || 0) + 1;
            }
        });

        const stats = [
            ['Total Schedules', data.schedules.length.toString()],
            ['Day Shift Classes', (shifts['Day'] || 0).toString()],
            ['Night Shift Classes', (shifts['Night'] || 0).toString()],
            ['Busiest Day', Object.keys(days).reduce((a, b) => days[a] > days[b] ? a : b, 'N/A')]
        ];

        doc.autoTable({
            startY: yPos,
            head: [['Metric', 'Value']],
            body: stats,
            theme: 'striped',
            headStyles: { fillColor: [139, 92, 246] },
            margin: { left: 20, right: 20 }
        });

        yPos = doc.lastAutoTable.finalY + 15;

        // Schedule List
        if (yPos > 180) {
            doc.addPage();
            yPos = 20;
        }
        this.addSectionHeader(doc, 'Complete Schedule List', yPos);
        yPos += 10;

        const scheduleData = data.schedules.map(schedule => {
            const subject = data.subjects?.find(s => s._id === schedule.subject);
            const teacher = data.teachers?.find(t => t._id === schedule.teacher);
            const section = data.sections?.find(s => s._id === schedule.section);
            const room = data.rooms?.find(r => r._id === schedule.room);

            return [
                subject?.code || 'N/A',
                subject?.title || 'N/A',
                teacher?.fullname || 'N/A',
                section?.name || 'N/A',
                room?.name || 'N/A',
                schedule.day || 'N/A',
                `${schedule.startTime || 'N/A'} - ${schedule.endTime || 'N/A'}`,
                schedule.type || 'N/A'
            ];
        });

        doc.autoTable({
            startY: yPos,
            head: [['Code', 'Subject', 'Teacher', 'Section', 'Room', 'Day', 'Time', 'Type']],
            body: scheduleData,
            theme: 'grid',
            headStyles: { fillColor: [139, 92, 246], fontSize: 8 },
            styles: { fontSize: 7, cellPadding: 2 },
            margin: { left: 15, right: 15 },
            columnStyles: {
                0: { cellWidth: 20 },
                1: { cellWidth: 50 },
                2: { cellWidth: 40 },
                3: { cellWidth: 30 },
                4: { cellWidth: 25 },
                5: { cellWidth: 25 },
                6: { cellWidth: 35 },
                7: { cellWidth: 20 }
            }
        });

        this.addFooterToAllPages(doc);
        doc.save(`CHRONIX_Schedules_Report_${this.getDateString()}.pdf`);
    }

    /**
     * Add cover page
     */
    addCoverPage(doc, title) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // Background gradient effect
        doc.setFillColor(...this.colors.primary);
        doc.rect(0, 0, pageWidth, pageHeight / 2, 'F');
        
        doc.setFillColor(...this.colors.secondary);
        doc.rect(0, pageHeight / 2, pageWidth, pageHeight / 2, 'F');

        // Logo placeholder (you can add actual logo here)
        doc.setFillColor(255, 255, 255);
        doc.circle(pageWidth / 2, 60, 20, 'F');
        
        // Title
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(32);
        doc.setFont('helvetica', 'bold');
        doc.text('CHRONIX', pageWidth / 2, 100, { align: 'center' });
        
        doc.setFontSize(20);
        doc.setFont('helvetica', 'normal');
        doc.text(title, pageWidth / 2, 115, { align: 'center' });

        // Date and info
        doc.setTextColor(...this.colors.primary);
        doc.setFontSize(12);
        doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight - 40, { align: 'center' });
        doc.text('Cebu Technological University', pageWidth / 2, pageHeight - 30, { align: 'center' });
        doc.setFontSize(10);
        doc.text('Academic Management System', pageWidth / 2, pageHeight - 22, { align: 'center' });
    }

    /**
     * Add section header
     */
    addSectionHeader(doc, title, yPos) {
        doc.setFillColor(...this.colors.primary);
        doc.rect(15, yPos - 5, doc.internal.pageSize.getWidth() - 30, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 20, yPos + 2);
        doc.setTextColor(...this.colors.text);
        doc.setFont('helvetica', 'normal');
    }

    /**
     * Add students section
     */
    addStudentsSection(doc, students, sections, yPos) {
        const yearLevels = {};
        students.forEach(student => {
            const section = sections.find(s => s._id === student.section);
            if (section) {
                yearLevels[section.yearLevel] = (yearLevels[section.yearLevel] || 0) + 1;
            }
        });

        const data = Object.entries(yearLevels).map(([year, count]) => [
            `Year ${year}`,
            count.toString(),
            ((count / students.length) * 100).toFixed(1) + '%'
        ]);

        doc.autoTable({
            startY: yPos,
            head: [['Year Level', 'Students', 'Percentage']],
            body: data,
            theme: 'striped',
            headStyles: { fillColor: this.colors.accent },
            margin: { left: 20, right: 20 }
        });
    }

    /**
     * Add teachers section
     */
    addTeachersSection(doc, teachers, yPos) {
        doc.setFontSize(11);
        doc.text(`Total Faculty Members: ${teachers.length}`, 20, yPos);
    }

    /**
     * Add rooms section
     */
    addRoomsSection(doc, rooms, yPos) {
        const statusCount = {};
        rooms.forEach(room => {
            statusCount[room.status] = (statusCount[room.status] || 0) + 1;
        });

        const data = Object.entries(statusCount).map(([status, count]) => [
            status,
            count.toString(),
            ((count / rooms.length) * 100).toFixed(1) + '%'
        ]);

        doc.autoTable({
            startY: yPos,
            head: [['Status', 'Count', 'Percentage']],
            body: data,
            theme: 'striped',
            headStyles: { fillColor: this.colors.success },
            margin: { left: 20, right: 20 }
        });
    }

    /**
     * Add footer to all pages
     */
    addFooterToAllPages(doc) {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(...this.colors.textLight);
            doc.text(
                `Page ${i} of ${pageCount}`,
                doc.internal.pageSize.getWidth() / 2,
                doc.internal.pageSize.getHeight() - 10,
                { align: 'center' }
            );
            doc.text(
                'CHRONIX - CTU Academic Management System',
                doc.internal.pageSize.getWidth() - 15,
                doc.internal.pageSize.getHeight() - 10,
                { align: 'right' }
            );
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
                <small>This may take a few moments</small>
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
