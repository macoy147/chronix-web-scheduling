/**
 * Schedule Export Utility - UPDATED with Header, Subject Summary, and Footer
 * Provides Excel and PDF export functionality with merged cells showing subjects, instructors, and rooms
 */

class ScheduleExporter {
    constructor() {
        this.loadedLibraries = {
            xlsx: false,
            jspdf: false,
            autoTable: false
        };
        
        // Time slots configuration (matching your sample)
        this.timeSlots = [
            { start: '7:00', end: '8:00', rowSpan: 1 },
            { start: '8:00', end: '9:00', rowSpan: 1 },
            { start: '9:00', end: '10:00', rowSpan: 1 },
            { start: '10:00', end: '11:00', rowSpan: 1 },
            { start: '11:00', end: '12:00', rowSpan: 1 },
            { start: '12:00', end: '13:00', rowSpan: 1, label: 'LUNCH' },
            { start: '13:00', end: '14:00', rowSpan: 1 },
            { start: '14:00', end: '15:00', rowSpan: 1 },
            { start: '15:00', end: '16:00', rowSpan: 1 },
            { start: '16:00', end: '17:00', rowSpan: 1 }
        ];
        
        this.days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
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

    /**
     * Create circular clipped image from base64
     */
    async createCircularImage(base64Image, size = 200) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                
                // Create circular clip path
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                
                // Draw image centered and scaled to fill circle
                const scale = Math.max(size / img.width, size / img.height);
                const x = (size / 2) - (img.width / 2) * scale;
                const y = (size / 2) - (img.height / 2) * scale;
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                
                try {
                    const dataURL = canvas.toDataURL('image/png');
                    resolve(dataURL);
                } catch (error) {
                    reject(error);
                }
            };
            img.onerror = function() {
                reject(new Error('Failed to create circular image'));
            };
            img.src = base64Image;
        });
    }

    /**
     * Convert schedule data to timetable format with merged cells - UPDATED FOR ENHANCED DISPLAY
     */
    convertToTimetableFormat(schedules) {
        // Initialize empty timetable grid
        const timetable = this.initializeTimetableGrid();
        
        // Sort schedules by day and start time for consistent placement
        const sortedSchedules = this.sortSchedulesByTime([...schedules]);
        
        // Process each schedule and place it in the timetable
        sortedSchedules.forEach(schedule => {
            this.placeScheduleInTimetable(timetable, schedule);
        });
        
        return timetable;
    }

    /**
     * Sort schedules by day and start time for consistent placement
     */
    sortSchedulesByTime(schedules) {
        const dayOrder = { 'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3, 'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6 };
        
        return schedules.sort((a, b) => {
            // Sort by day first
            const dayA = a.day.toUpperCase();
            const dayB = b.day.toUpperCase();
            const dayDiff = (dayOrder[dayA] || 99) - (dayOrder[dayB] || 99);
            if (dayDiff !== 0) return dayDiff;

            // Then sort by start time
            const startTimeA = this.convertTo24Hour(a.startTime, a.startPeriod);
            const startTimeB = this.convertTo24Hour(b.startTime, b.startPeriod);
            return startTimeA.localeCompare(startTimeB);
        });
    }

    /**
     * Initialize empty timetable grid structure
     */
    initializeTimetableGrid() {
        const grid = [];
        
        this.timeSlots.forEach((timeSlot, timeIndex) => {
            const row = {
                time: timeSlot.label || `${timeSlot.start} - ${timeSlot.end}`,
                days: {}
            };
            
            this.days.forEach(day => {
                row.days[day] = {
                    content: '',
                    rowSpan: 1,
                    isOccupied: false,
                    schedule: null,
                    isMerged: false
                };
            });
            
            grid.push(row);
        });
        
        return grid;
    }

    /**
     * Place a schedule in the timetable with proper merging - UPDATED FOR ENHANCED DISPLAY
     */
    placeScheduleInTimetable(timetable, schedule) {
        const day = schedule.day.toUpperCase();
        const scheduleStartTime = this.convertTo24Hour(schedule.startTime, schedule.startPeriod);
        const scheduleEndTime = this.convertTo24Hour(schedule.endTime, schedule.endPeriod);
        
        // Find the starting time slot
        const startSlotIndex = this.findTimeSlotIndex(scheduleStartTime);
        const endSlotIndex = this.findTimeSlotIndex(scheduleEndTime);
        
        if (startSlotIndex === -1 || endSlotIndex === -1) {
            console.warn(`Schedule time out of range: ${scheduleStartTime} - ${scheduleEndTime}`);
            return;
        }
        
        const durationSlots = endSlotIndex - startSlotIndex;
        
        if (durationSlots <= 0) {
            console.warn(`Invalid schedule duration: ${scheduleStartTime} - ${scheduleEndTime}`);
            return;
        }
        
        // Check if slots are available
        if (!this.isTimeSlotAvailable(timetable, day, startSlotIndex, durationSlots)) {
            console.warn(`Time slot not available for schedule: ${this.getSubjectDisplay(schedule)} on ${day}`);
            return;
        }
        
        // Create enhanced schedule display text
        const displayText = this.createEnhancedDisplayText(schedule);
        
        // Place the schedule in the timetable
        timetable[startSlotIndex].days[day] = {
            content: displayText,
            rowSpan: durationSlots,
            isOccupied: true,
            schedule: schedule,
            isMerged: durationSlots > 1
        };
        
        // Mark subsequent slots as occupied (for merging)
        for (let i = 1; i < durationSlots; i++) {
            timetable[startSlotIndex + i].days[day] = {
                content: '', // Empty content for merged cells
                rowSpan: 0, // 0 means this cell is part of a merged cell above
                isOccupied: true,
                schedule: schedule,
                isMerged: true
            };
        }
    }

    /**
     * Create enhanced display text with subject, instructor, and room
     */
    createEnhancedDisplayText(schedule) {
        // Get subject code
        const subjectCode = schedule.subject?.courseCode || schedule.subject || 'N/A';
        const isLab = schedule.scheduleType === 'lab';
        
        // Format subject like "PC 317" or "PC 315 L"
        let subjectText = subjectCode.trim();
        if (isLab) {
            subjectText += ' L';
        }
        
        // Format instructor name: "Lastname, FI" (Last name + First Initial)
        const instructorText = this.formatInstructorName(schedule.teacher?.fullname || 'TBA');
        
        // Format room
        const roomText = schedule.room?.roomName || 'TBA';
        
        // Format time in 12-hour format with AM/PM
        const timeDisplay = this.formatTime12Hour(
            schedule.startTime, 
            schedule.startPeriod, 
            schedule.endTime, 
            schedule.endPeriod
        );
        
        // Combine all parts - NOW WITH 12-HOUR TIME FORMAT
        return `${subjectText}\n${timeDisplay}\n${instructorText}\n${roomText}`;
    }

    /**
     * Format time in 12-hour format with AM/PM
     */
    formatTime12Hour(startTime, startPeriod, endTime, endPeriod) {
        // If the times already have AM/PM indicators, use them directly
        if (startPeriod && endPeriod) {
            return `${startTime} ${startPeriod} - ${endTime} ${endPeriod}`;
        }
        
        // Otherwise, convert from 24-hour format if needed
        const formatTimePart = (time, period) => {
            if (!time) return 'TBA';
            
            // If time already has AM/PM, return as is
            if (period) {
                return `${time} ${period}`;
            }
            
            // Convert 24-hour format to 12-hour format
            const [hours, minutes] = time.split(':').map(Number);
            let period12 = 'AM';
            let hours12 = hours;
            
            if (hours >= 12) {
                period12 = 'PM';
                if (hours > 12) {
                    hours12 = hours - 12;
                }
            }
            if (hours === 0) {
                hours12 = 12;
            }
            
            return `${hours12}:${String(minutes).padStart(2, '0')} ${period12}`;
        };
        
        const startFormatted = formatTimePart(startTime, startPeriod);
        const endFormatted = formatTimePart(endTime, endPeriod);
        
        return `${startFormatted} - ${endFormatted}`;
    }

    /**
     * Format instructor name to "Lastname, FI" format
     */
    formatInstructorName(fullName) {
        if (!fullName || fullName === 'TBA') return 'TBA';
        
        const nameParts = fullName.trim().split(' ').filter(part => part.length > 0);
        
        if (nameParts.length === 0) return 'TBA';
        if (nameParts.length === 1) return nameParts[0]; // Single name
        
        // Get last name (last word)
        const lastName = nameParts[nameParts.length - 1];
        
        // Get first initial (first character of first name)
        const firstInitial = nameParts[0].charAt(0).toUpperCase();
        
        // If there's a middle name, get its initial too
        let middleInitial = '';
        if (nameParts.length > 2) {
            middleInitial = nameParts[1].charAt(0).toUpperCase();
        }
        
        return `${lastName}, ${firstInitial}${middleInitial}`;
    }

    /**
     * Get subject display for logging
     */
    getSubjectDisplay(schedule) {
        return schedule.subject?.courseCode || schedule.subject || 'Unknown Subject';
    }

    /**
     * Convert 12-hour time to 24-hour format
     */
    convertTo24Hour(time, period) {
        let [hours, minutes] = time.split(':').map(Number);
        
        if (period === 'PM' && hours !== 12) {
            hours += 12;
        } else if (period === 'AM' && hours === 12) {
            hours = 0;
        }
        
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    /**
     * Find the time slot index for a given time
     */
    findTimeSlotIndex(time24) {
        const [targetHours, targetMinutes] = time24.split(':').map(Number);
        const targetTotalMinutes = targetHours * 60 + targetMinutes;
        
        for (let i = 0; i < this.timeSlots.length; i++) {
            const [startHours, startMinutes] = this.timeSlots[i].start.split(':').map(Number);
            const startTotalMinutes = startHours * 60 + startMinutes;
            
            const [endHours, endMinutes] = this.timeSlots[i].end.split(':').map(Number);
            const endTotalMinutes = endHours * 60 + endMinutes;
            
            if (targetTotalMinutes >= startTotalMinutes && targetTotalMinutes < endTotalMinutes) {
                return i;
            }
        }
        
        return -1;
    }

    /**
     * Check if time slots are available
     */
    isTimeSlotAvailable(timetable, day, startIndex, duration) {
        for (let i = 0; i < duration; i++) {
            if (startIndex + i >= timetable.length) {
                return false;
            }
            
            if (timetable[startIndex + i].days[day].isOccupied) {
                return false;
            }
        }
        return true;
    }

    /**
     * Extract unique subjects from schedules for the summary
     */
    extractSubjectsSummary(schedules) {
        const subjectsMap = new Map();
        
        schedules.forEach(schedule => {
            const subject = schedule.subject;
            if (subject && !subjectsMap.has(subject._id)) {
                subjectsMap.set(subject._id, {
                    units: subject.units || 3, // Default to 3 units if not specified
                    courseCode: subject.courseCode,
                    descriptiveTitle: subject.descriptiveTitle
                });
            }
        });
        
        return Array.from(subjectsMap.values());
    }

    /**
     * Get section details from schedules
     */
    getSectionDetails(schedules) {
        if (!schedules || schedules.length === 0) {
            return {
                sectionName: 'N/A',
                adviser: 'N/A',
                shift: 'N/A'
            };
        }
        
        // Get the first schedule's section details
        const firstSchedule = schedules[0];
        const section = firstSchedule.section;
        
        return {
            sectionName: section?.sectionName || 'N/A',
            adviser: section?.adviser || 'N/A',
            shift: section?.shift || 'N/A'
        };
    }

    /**
     * Export to PDF with enhanced subject display - UPDATED WITH HEADER, SUMMARY, AND FOOTER
     */
    async exportToPDF(schedules, filename = 'timetable', userInfo = {}) {
        try {
            await this.loadLibraries();

            if (!schedules || schedules.length === 0) {
                throw new Error('No schedules to export');
            }

            // Convert to timetable format with enhanced display
            const timetable = this.convertToTimetableFormat(schedules);

            // Extract subjects for summary
            const subjectsSummary = this.extractSubjectsSummary(schedules);

            // Get section details
            const sectionDetails = this.getSectionDetails(schedules);

            // Create PDF - PORTRAIT ORIENTATION 8x13 inches
            // Convert inches to mm: 8in = 203.2mm, 13in = 330.2mm
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('p', 'mm', [330.2, 203.2]); // Portrait, 8x13 inches in mm

            // Load logos
            let ctuLogo = null;
            let chronixLogo = null;
            let bagongPilipinasLogo = null;
            let wuriFooter = null;
            
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

            try {
                bagongPilipinasLogo = await this.loadImageAsBase64('/img/img/BAGONG_PILIPINAS_LOGO.png');
            } catch (error) {
                console.warn('Failed to load BAGONG PILIPINAS logo:', error);
            }

            try {
                wuriFooter = await this.loadImageAsBase64('/img/img/WURI_FOOTER.png');
            } catch (error) {
                console.warn('Failed to load WURI footer:', error);
            }

            let yPos = 15;

            // Add header with logos and text
            if (ctuLogo) {
                try {
                    doc.addImage(ctuLogo, 'PNG', 14, yPos, 18, 18);
                } catch (error) {
                    console.warn('Failed to add CTU logo to PDF:', error);
                }
            }

            if (chronixLogo) {
                try {
                    doc.addImage(chronixLogo, 'PNG', 35, yPos, 18, 18);
                } catch (error) {
                    console.warn('Failed to add CHRONIX logo to PDF:', error);
                }
            }

            // Add BAGONG PILIPINAS logo
            if (bagongPilipinasLogo) {
                try {
                    doc.addImage(bagongPilipinasLogo, 'PNG', doc.internal.pageSize.getWidth() - 32, yPos, 18, 18);
                } catch (error) {
                    console.warn('Failed to add BAGONG PILIPINAS logo to PDF:', error);
                }
            }

            // Add header text (centered)
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0, 45, 98); // CTU Deep Blue
            
            // Republic of the Philippines text
            doc.text('Republic of the Philippines', doc.internal.pageSize.getWidth() / 2, yPos + 5, { align: 'center' });
            
            // CEBU TECHNOLOGICAL UNIVERSITY text
            doc.setFontSize(14);
            doc.text('CEBU TECHNOLOGICAL UNIVERSITY', doc.internal.pageSize.getWidth() / 2, yPos + 10, { align: 'center' });
            
            // Province of Cebu text
            doc.setFontSize(10);
            doc.setFont(undefined, 'normal');
            doc.text('Province of Cebu', doc.internal.pageSize.getWidth() / 2, yPos + 15, { align: 'center' });
            
            // Main campus location
            doc.text('Main Campus: M.J. Cuenco Ave., Cebu City', doc.internal.pageSize.getWidth() / 2, yPos + 20, { align: 'center' });
            
            // Daanbantayan Campus
            doc.text('Daanbantayan Campus: Aguho, Daanbantayan, Cebu', doc.internal.pageSize.getWidth() / 2, yPos + 25, { align: 'center' });

            yPos += 35;

            // Add horizontal line
            doc.setDrawColor(242, 210, 131); // CTU Gold
            doc.setLineWidth(0.5);
            doc.line(14, yPos, doc.internal.pageSize.getWidth() - 14, yPos);

            yPos += 8;

            // Add user information - UPDATED LAYOUT
            doc.setFillColor(244, 247, 249); // Light gray background
            const infoBoxHeight = 22; // Increased height for additional rows
            doc.rect(14, yPos, doc.internal.pageSize.getWidth() - 28, infoBoxHeight, 'F');
            doc.setDrawColor(224, 224, 224);
            doc.setLineWidth(0.3);
            doc.rect(14, yPos, doc.internal.pageSize.getWidth() - 28, infoBoxHeight);

            doc.setFontSize(9);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0, 45, 98);

            let infoYPos = yPos + 6;
            const col1X = 20;
            const col2X = 100;
            const col3X = 180;

            // Row 1: Name and Section
            if (userInfo.name) {
                doc.text('Name:', col1X, infoYPos);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(85, 85, 85);
                doc.text(userInfo.name, col1X + 12, infoYPos);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(0, 45, 98);
            }

            if (sectionDetails.sectionName) {
                doc.text('Section:', col2X, infoYPos);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(85, 85, 85);
                doc.text(sectionDetails.sectionName, col2X + 15, infoYPos);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(0, 45, 98);
            }

            infoYPos += 6;

            // Row 2: Advisor Name and Export Date
            if (sectionDetails.adviser) {
                doc.text('Advisor Name:', col1X, infoYPos);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(85, 85, 85);
                doc.text(sectionDetails.adviser, col1X + 25, infoYPos);
                doc.setFont(undefined, 'bold');
                doc.setTextColor(0, 45, 98);
            }

            doc.text('Export Date:', col2X, infoYPos);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(85, 85, 85);
            doc.text(new Date().toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            }), col2X + 22, infoYPos);
            
            infoYPos += 6;

            // Row 3: Total Classes and Shift
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0, 45, 98);
            doc.text('Total Classes:', col1X, infoYPos);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(85, 85, 85);
            doc.text(schedules.length.toString(), col1X + 25, infoYPos);
            
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0, 45, 98);
            doc.text('Shift:', col2X, infoYPos);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(85, 85, 85);
            doc.text(sectionDetails.shift, col2X + 10, infoYPos);

            yPos += infoBoxHeight + 12;

            // Create timetable table with enhanced display
            const timetableEndY = this.createEnhancedTimetableTable(doc, timetable, yPos);
            
            // Add subjects summary after timetable
            yPos = timetableEndY + 10;
            
            // Add summary title
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0, 45, 98);
            doc.text('SUMMARY OF COURSES', 14, yPos);
            
            yPos += 8;
            
            // Add summary table header
            doc.setFillColor(0, 45, 98);
            doc.rect(14, yPos, doc.internal.pageSize.getWidth() - 28, 8, 'F');
            
            doc.setFontSize(8);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text('UNITS', 20, yPos + 5);
            doc.text('SUBJECT CODE', 50, yPos + 5);
            doc.text('DESCRIPTIVE TITLE', 120, yPos + 5);
            
            yPos += 8;
            
            // Add summary rows
            doc.setFontSize(7);
            doc.setFont(undefined, 'normal');
            doc.setTextColor(0, 0, 0);
            
            subjectsSummary.forEach((subject, index) => {
                // Alternate row colors
                if (index % 2 === 0) {
                    doc.setFillColor(245, 247, 249);
                    doc.rect(14, yPos, doc.internal.pageSize.getWidth() - 28, 6, 'F');
                }
                
                doc.text(subject.units.toString(), 20, yPos + 4);
                doc.text(subject.courseCode, 50, yPos + 4);
                
                // Handle long descriptive titles by wrapping text
                const maxWidth = doc.internal.pageSize.getWidth() - 140;
                const wrappedTitle = doc.splitTextToSize(subject.descriptiveTitle, maxWidth);
                doc.text(wrappedTitle, 120, yPos + 4);
                
                // Increase yPos based on number of lines in wrapped title
                yPos += Math.max(6, (wrappedTitle.length * 3));
                
                // Check if we need a new page for the summary
                if (yPos > doc.internal.pageSize.getHeight() - 40 && index < subjectsSummary.length - 1) {
                    doc.addPage();
                    yPos = 20;
                    
                    // Redraw summary header on new page
                    doc.setFillColor(0, 45, 98);
                    doc.rect(14, yPos, doc.internal.pageSize.getWidth() - 28, 8, 'F');
                    doc.setFontSize(8);
                    doc.setFont(undefined, 'bold');
                    doc.setTextColor(255, 255, 255);
                    doc.text('UNITS', 20, yPos + 5);
                    doc.text('SUBJECT CODE', 50, yPos + 5);
                    doc.text('DESCRIPTIVE TITLE', 120, yPos + 5);
                    yPos += 8;
                }
            });

            // Add footer to all pages
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                
                // Add WURI footer image if available
                if (wuriFooter && i === pageCount) {
                    try {
                        const footerHeight = 20;
                        const footerWidth = doc.internal.pageSize.getWidth() - 28;
                        doc.addImage(
                            wuriFooter, 
                            'PNG', 
                            14, 
                            doc.internal.pageSize.getHeight() - footerHeight - 10, 
                            footerWidth, 
                            footerHeight
                        );
                    } catch (error) {
                        console.warn('Failed to add WURI footer to PDF:', error);
                        
                        // Fallback: Add text footer
                        doc.setDrawColor(242, 210, 131); // CTU Gold
                        doc.setLineWidth(0.3);
                        doc.line(14, doc.internal.pageSize.getHeight() - 12, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 12);
                        
                        // Footer text
                        doc.setFontSize(7);
                        doc.setTextColor(128);
                        doc.text(
                            'Generated by CHRONIX - CTU Class Scheduling System',
                            14,
                            doc.internal.pageSize.getHeight() - 8
                        );
                    }
                } else {
                    // Regular footer for other pages
                    doc.setDrawColor(242, 210, 131); // CTU Gold
                    doc.setLineWidth(0.3);
                    doc.line(14, doc.internal.pageSize.getHeight() - 12, doc.internal.pageSize.getWidth() - 14, doc.internal.pageSize.getHeight() - 12);
                    
                    // Footer text
                    doc.setFontSize(7);
                    doc.setTextColor(128);
                    doc.text(
                        'Generated by CHRONIX - CTU Class Scheduling System',
                        14,
                        doc.internal.pageSize.getHeight() - 8
                    );
                }
            }

            // Generate filename
            const exportFilename = `${filename}_${new Date().toISOString().split('T')[0]}.pdf`;

            // Save file
            doc.save(exportFilename);

            console.log('✅ PDF enhanced timetable export successful:', exportFilename);
            return true;
        } catch (error) {
            console.error('❌ Error exporting enhanced timetable to PDF:', error);
            throw error;
        }
    }

    /**
     * Create the enhanced timetable table with merged cells - UPDATED FOR PORTRAIT
     */
    createEnhancedTimetableTable(doc, timetable, startY) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;
        const tableWidth = pageWidth - (margin * 2);
        
        // Calculate column widths for portrait orientation
        const timeColWidth = 25;
        const dayColWidth = (tableWidth - timeColWidth) / this.days.length;
        
        let currentY = startY;
        const rowHeight = 10; // Slightly taller rows for multi-line content
        
        // Draw table header
        doc.setFillColor(0, 45, 98); // CTU Deep Blue
        doc.rect(margin, currentY, tableWidth, rowHeight, 'F');
        
        // Header text
        doc.setFontSize(8);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(255, 255, 255);
        
        // Time header
        doc.text('TIME', margin + 2, currentY + 6);
        
        // Day headers
        this.days.forEach((day, index) => {
            const xPos = margin + timeColWidth + (index * dayColWidth);
            doc.text(day, xPos + (dayColWidth / 2), currentY + 6, { align: 'center' });
        });
        
        currentY += rowHeight;
        
        // Draw timetable rows
        timetable.forEach((row, rowIndex) => {
            // Draw time column
            doc.setFillColor(245, 247, 249); // Light gray
            doc.rect(margin, currentY, timeColWidth, rowHeight, 'F');
            doc.setDrawColor(224, 224, 224);
            doc.rect(margin, currentY, timeColWidth, rowHeight);
            
            doc.setFontSize(7);
            doc.setFont(undefined, 'bold');
            doc.setTextColor(0, 45, 98);
            doc.text(row.time, margin + 2, currentY + 6);
            
            // Draw day columns
            this.days.forEach((day, dayIndex) => {
                const xPos = margin + timeColWidth + (dayIndex * dayColWidth);
                const cell = row.days[day];
                
                // Only draw cells that are not part of a merged cell (rowSpan = 0)
                if (cell.rowSpan !== 0) {
                    const cellHeight = rowHeight * cell.rowSpan;
                    
                    // Draw cell background
                    doc.setFillColor(255, 255, 255); // White background
                    doc.rect(xPos, currentY, dayColWidth, cellHeight, 'F');
                    
                    // Draw cell border
                    doc.setDrawColor(224, 224, 224);
                    doc.rect(xPos, currentY, dayColWidth, cellHeight);
                    
                    // Add cell content if present
                    if (cell.content) {
                        // Add subtle background color based on schedule type
                        if (cell.schedule) {
                            const fillColor = cell.schedule.scheduleType === 'lab' 
                                ? [255, 243, 224] // Light orange for lab
                                : [224, 242, 255]; // Light blue for lecture
                            
                            doc.setFillColor(...fillColor);
                            doc.rect(xPos + 1, currentY + 1, dayColWidth - 2, cellHeight - 2, 'F');
                        }
                        
                        // Split content into lines
                        const lines = cell.content.split('\n');
                        
                        // Calculate vertical position for each line
                        const lineHeight = 3;
                        const totalTextHeight = lines.length * lineHeight;
                        const startTextY = currentY + (cellHeight - totalTextHeight) / 2 + 2;
                        
                        // Draw each line
                        doc.setFontSize(6);
                        doc.setFont(undefined, 'bold');
                        doc.setTextColor(0, 0, 0);
                        
                        lines.forEach((line, lineIndex) => {
                            const lineY = startTextY + (lineIndex * lineHeight);
                            
                            // First line (subject) is bold, others are normal
                            if (lineIndex === 0) {
                                doc.setFont(undefined, 'bold');
                                doc.setFontSize(6);
                            } else {
                                doc.setFont(undefined, 'normal');
                                doc.setFontSize(5);
                            }
                            
                            doc.text(line, xPos + (dayColWidth / 2), lineY, { 
                                align: 'center',
                                maxWidth: dayColWidth - 4
                            });
                        });
                        
                        // Add duration indicator for merged cells
                        if (cell.isMerged && cell.schedule) {
                            const duration = this.calculateDuration(
                                cell.schedule.startTime, 
                                cell.schedule.startPeriod,
                                cell.schedule.endTime, 
                                cell.schedule.endPeriod
                            );
                            
                            // Add small duration indicator at bottom
                            doc.setFontSize(5);
                            doc.setFont(undefined, 'normal');
                            doc.setTextColor(100, 100, 100);
                            doc.text(
                                `${duration}h`, 
                                xPos + (dayColWidth / 2), 
                                currentY + cellHeight - 2, 
                                { align: 'center' }
                            );
                        }
                    }
                }
            });
            
            currentY += rowHeight;
            
            // Check if we need a new page
            if (currentY > doc.internal.pageSize.getHeight() - 60 && rowIndex < timetable.length - 1) {
                doc.addPage();
                currentY = margin;
                
                // Redraw header on new page
                doc.setFillColor(0, 45, 98);
                doc.rect(margin, currentY, tableWidth, rowHeight, 'F');
                doc.setTextColor(255, 255, 255);
                doc.text('TIME', margin + 2, currentY + 6);
                
                this.days.forEach((day, index) => {
                    const xPos = margin + timeColWidth + (index * dayColWidth);
                    doc.text(day, xPos + (dayColWidth / 2), currentY + 6, { align: 'center' });
                });
                
                currentY += rowHeight;
            }
        });
        
        return currentY;
    }

    /**
     * Calculate duration in hours for display
     */
    calculateDuration(startTime, startPeriod, endTime, endPeriod) {
        const start24 = this.convertTo24Hour(startTime, startPeriod);
        const end24 = this.convertTo24Hour(endTime, endPeriod);
        
        const [startH, startM] = start24.split(':').map(Number);
        const [endH, endM] = end24.split(':').map(Number);
        
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        
        return (endMinutes - startMinutes) / 60;
    }

    /**
     * Export to Excel with enhanced subject display
     */
    async exportToExcel(schedules, filename = 'timetable', userInfo = {}) {
        try {
            await this.loadLibraries();

            if (!schedules || schedules.length === 0) {
                throw new Error('No schedules to export');
            }

            // Convert to timetable format with enhanced display
            const timetable = this.convertToTimetableFormat(schedules);

            // Extract subjects for summary
            const subjectsSummary = this.extractSubjectsSummary(schedules);

            // Get section details
            const sectionDetails = this.getSectionDetails(schedules);

            // Create workbook
            const wb = window.XLSX.utils.book_new();

            // Prepare data for Excel with merged cells
            const excelData = this.prepareEnhancedExcelData(timetable, userInfo, subjectsSummary, sectionDetails);

            // Create worksheet
            const ws = window.XLSX.utils.aoa_to_sheet(excelData.data);

            // Apply merges
            ws['!merges'] = excelData.merges;

            // Apply styling
            this.applyEnhancedExcelStyling(ws, excelData.data);

            // Add worksheet to workbook
            window.XLSX.utils.book_append_sheet(wb, ws, 'Timetable');

            // Generate filename
            const exportFilename = `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`;

            // Save file
            window.XLSX.writeFile(wb, exportFilename);

            console.log('✅ Excel enhanced timetable export successful:', exportFilename);
            return true;
        } catch (error) {
            console.error('❌ Error exporting to Excel:', error);
            throw error;
        }
    }

    /**
     * Prepare data for Excel export with merged cells - UPDATED FOR ENHANCED DISPLAY WITH SUMMARY
     */
    prepareEnhancedExcelData(timetable, userInfo, subjectsSummary, sectionDetails) {
        const data = [];
        const merges = [];
        
        // Title row
        data.push(['Republic of the Philippines']);
        merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: this.days.length } });
        
        // University name
        data.push(['CEBU TECHNOLOGICAL UNIVERSITY']);
        merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: this.days.length } });
        
        // Campus information
        data.push(['Daanbantayan Campus: Aguho, Daanbantayan, Cebu']);
        merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: this.days.length } });
        
        // Empty row
        data.push([]);
        
        // CHRONIX title
        data.push(['CHRONIX - Class Timetable']);
        merges.push({ s: { r: 4, c: 0 }, e: { r: 4, c: this.days.length } });
        
        // User info - UPDATED LAYOUT
        if (userInfo.name) {
            data.push([`Name: ${userInfo.name}`]);
            merges.push({ s: { r: 5, c: 0 }, e: { r: 5, c: this.days.length } });
        }
        
        if (sectionDetails.sectionName) {
            data.push([`Section: ${sectionDetails.sectionName}`]);
            merges.push({ s: { r: 6, c: 0 }, e: { r: 6, c: this.days.length } });
        }
        
        if (sectionDetails.adviser) {
            data.push([`Advisor Name: ${sectionDetails.adviser}`]);
            merges.push({ s: { r: 7, c: 0 }, e: { r: 7, c: this.days.length } });
        }
        
        data.push([`Export Date: ${new Date().toLocaleDateString()}`]);
        merges.push({ s: { r: 8, c: 0 }, e: { r: 8, c: this.days.length } });
        
        data.push([`Total Classes: ${timetable.flatMap(row => Object.values(row.days)).filter(cell => cell.content).length} | Shift: ${sectionDetails.shift}`]);
        merges.push({ s: { r: 9, c: 0 }, e: { r: 9, c: this.days.length } });
        
        // Empty row
        data.push([]);
        
        // Table header
        const headerRow = ['TIME', ...this.days];
        data.push(headerRow);
        
        // Timetable data - NOW WITH ENHANCED DISPLAY
        timetable.forEach((row, rowIndex) => {
            const dataRow = [row.time];
            
            this.days.forEach(day => {
                const cell = row.days[day];
                dataRow.push(cell.content);
                
                // Add merge information for cells with rowSpan > 1
                if (cell.rowSpan > 1) {
                    merges.push({
                        s: { r: 11 + rowIndex, c: 1 + this.days.indexOf(day) },
                        e: { r: 11 + rowIndex + cell.rowSpan - 1, c: 1 + this.days.indexOf(day) }
                    });
                }
            });
            
            data.push(dataRow);
        });
        
        // Empty rows before summary
        data.push([]);
        data.push([]);
        
        // Summary title
        data.push(['SUMMARY OF COURSES']);
        merges.push({ s: { r: data.length - 1, c: 0 }, e: { r: data.length - 1, c: 2 } });
        
        // Summary header
        data.push(['UNITS', 'SUBJECT CODE', 'DESCRIPTIVE TITLE']);
        
        // Summary data
        subjectsSummary.forEach(subject => {
            data.push([
                subject.units,
                subject.courseCode,
                subject.descriptiveTitle
            ]);
        });
        
        return { data, merges };
    }

    /**
     * Apply enhanced styling to Excel worksheet
     */
    applyEnhancedExcelStyling(ws, data) {
        // Define styles
        const titleStyle = {
            font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: "002D62" } },
            alignment: { horizontal: 'center', vertical: 'center' }
        };
        
        const universityStyle = {
            font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: "002D62" } },
            alignment: { horizontal: 'center', vertical: 'center' }
        };
        
        const headerStyle = {
            font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "002D62" } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
                top: { style: 'thin', color: { rgb: "000000" } },
                bottom: { style: 'thin', color: { rgb: "000000" } },
                left: { style: 'thin', color: { rgb: "000000" } },
                right: { style: 'thin', color: { rgb: "000000" } }
            }
        };
        
        const timeCellStyle = {
            font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: "002D62" } },
            fill: { fgColor: { rgb: "F4F7F9" } },
            alignment: { horizontal: 'left', vertical: 'center' },
            border: {
                top: { style: 'thin', color: { rgb: "E0E0E0" } },
                bottom: { style: 'thin', color: { rgb: "E0E0E0" } },
                left: { style: 'thin', color: { rgb: "E0E0E0" } },
                right: { style: 'thin', color: { rgb: "E0E0E0" } }
            }
        };
        
        const lectureCellStyle = {
            font: { name: 'Calibri', sz: 8, bold: true, color: { rgb: "000000" } },
            fill: { fgColor: { rgb: "E0F2FE" } }, // Light blue for lectures
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
                top: { style: 'thin', color: { rgb: "E0E0E0" } },
                bottom: { style: 'thin', color: { rgb: "E0E0E0" } },
                left: { style: 'thin', color: { rgb: "E0E0E0" } },
                right: { style: 'thin', color: { rgb: "E0E0E0" } }
            }
        };
        
        const labCellStyle = {
            font: { name: 'Calibri', sz: 8, bold: true, color: { rgb: "000000" } },
            fill: { fgColor: { rgb: "FFF3E0" } }, // Light orange for labs
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
                top: { style: 'thin', color: { rgb: "E0E0E0" } },
                bottom: { style: 'thin', color: { rgb: "E0E0E0" } },
                left: { style: 'thin', color: { rgb: "E0E0E0" } },
                right: { style: 'thin', color: { rgb: "E0E0E0" } }
            }
        };
        
        const summaryHeaderStyle = {
            font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "002D62" } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: {
                top: { style: 'thin', color: { rgb: "000000" } },
                bottom: { style: 'thin', color: { rgb: "000000" } },
                left: { style: 'thin', color: { rgb: "000000" } },
                right: { style: 'thin', color: { rgb: "000000" } }
            }
        };
        
        const summaryRowStyle = {
            font: { name: 'Calibri', sz: 10, color: { rgb: "000000" } },
            alignment: { horizontal: 'left', vertical: 'center' },
            border: {
                top: { style: 'thin', color: { rgb: "E0E0E0" } },
                bottom: { style: 'thin', color: { rgb: "E0E0E0" } },
                left: { style: 'thin', color: { rgb: "E0E0E0" } },
                right: { style: 'thin', color: { rgb: "E0E0E0" } }
            }
        };
        
        // Apply styles to cells
        data.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                const cellRef = window.XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
                
                if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
                
                if (rowIndex === 0) {
                    ws[cellRef].s = titleStyle;
                } else if (rowIndex === 1) {
                    ws[cellRef].s = universityStyle;
                } else if (rowIndex === 11) { // Header row
                    ws[cellRef].s = headerStyle;
                } else if (rowIndex > 11 && colIndex === 0) { // Time column
                    ws[cellRef].s = timeCellStyle;
                } else if (rowIndex > 11 && colIndex > 0 && cell) { // Class cells with content
                    // Determine if this is a lecture or lab based on the "L" suffix
                    const isLab = cell.toString().includes(' L\n');
                    ws[cellRef].s = isLab ? labCellStyle : lectureCellStyle;
                } else if (rowIndex > 11 && colIndex > 0) { // Empty class cells
                    ws[cellRef].s = {
                        font: { name: 'Calibri', sz: 9, color: { rgb: "000000" } },
                        alignment: { horizontal: 'center', vertical: 'center' },
                        border: {
                            top: { style: 'thin', color: { rgb: "E0E0E0" } },
                            bottom: { style: 'thin', color: { rgb: "E0E0E0" } },
                            left: { style: 'thin', color: { rgb: "E0E0E0" } },
                            right: { style: 'thin', color: { rgb: "E0E0E0" } }
                        }
                    };
                } else if (rowIndex >= data.length - subjectsSummary.length - 2 && rowIndex < data.length - 1 && colIndex < 3) {
                    // Summary rows
                    if (rowIndex === data.length - subjectsSummary.length - 2) {
                        // Summary title
                        ws[cellRef].s = {
                            font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: "002D62" } },
                            alignment: { horizontal: 'center', vertical: 'center' }
                        };
                    } else if (rowIndex === data.length - subjectsSummary.length - 1) {
                        // Summary header
                        ws[cellRef].s = summaryHeaderStyle;
                    } else {
                        // Summary data rows
                        ws[cellRef].s = summaryRowStyle;
                    }
                }
            });
        });
        
        // Set column widths
        ws['!cols'] = [
            { wch: 10 }, // Time column
            ...this.days.map(() => ({ wch: 18 })), // Day columns (wider for multi-line content)
            { wch: 8 }, // Units column in summary
            { wch: 15 }, // Course code column in summary
            { wch: 40 } // Descriptive title column in summary
        ];
        
        // Set row heights
        ws['!rows'] = data.map((row, index) => {
            if (index === 0 || index === 2) return { hpt: 20 };
            if (index === 1) return { hpt: 25 };
            if (index === 11) return { hpt: 20 };
            if (index > 11 && index < data.length - subjectsSummary.length - 2) return { hpt: 45 }; // Taller rows for multi-line content
            if (index >= data.length - subjectsSummary.length - 2) return { hpt: 20 }; // Summary rows
            return { hpt: 15 };
        });
    }

    /**
     * Show export options dialog - UPDATED for enhanced timetable format
     */
    showExportDialog(schedules, userInfo = {}, filename = 'timetable') {
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
                max-width: 450px;
                width: 90%;
                box-shadow: 0 12px 48px rgba(0,0,0,0.2);
                animation: slideUp 0.3s ease;
            `;

            modal.innerHTML = `
                <h3 style="margin: 0 0 20px 0; color: #002D62; font-size: 1.4em;">Export Timetable</h3>
                <p style="margin-bottom: 16px; color: #555;">Choose your preferred export format:</p>
                <p style="margin-bottom: 24px; font-size: 0.9em; color: #666; background: #f8f9fa; padding: 12px; border-radius: 8px;">
                    <strong>Enhanced Format:</strong> Shows subject, instructor, and room information with official CTU header and footer
                </p>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <button id="exportExcelBtn" style="
                        padding: 14px 24px;
                        background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
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
                        Export to Excel (Enhanced)
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
                        Export to PDF (Enhanced)
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
                excelBtn.style.boxShadow = '0 6px 20px rgba(76, 175, 80, 0.4)';
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
                    excelBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Exporting Timetable...';
                    await this.exportToExcel(schedules, filename, userInfo);
                    document.body.removeChild(overlay);
                    resolve('excel');
                } catch (error) {
                    excelBtn.disabled = false;
                    excelBtn.innerHTML = '<i class="bi bi-file-earmark-excel"></i> Export to Excel (Enhanced)';
                    reject(error);
                }
            });

            pdfBtn.addEventListener('click', async () => {
                try {
                    pdfBtn.disabled = true;
                    pdfBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> Exporting Timetable...';
                    await this.exportToPDF(schedules, filename, userInfo);
                    document.body.removeChild(overlay);
                    resolve('pdf');
                } catch (error) {
                    pdfBtn.disabled = false;
                    pdfBtn.innerHTML = '<i class="bi bi-file-earmark-pdf"></i> Export to PDF (Enhanced)';
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