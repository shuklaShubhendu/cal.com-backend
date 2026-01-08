const nodemailer = require('nodemailer');

// Create a transporter using Ethereal for testing
let transporter;

async function createTransporter() {
    if (transporter) return transporter;

    // Use Ethereal for testing - this prints a URL to the console to view the email
    const testAccount = await nodemailer.createTestAccount();

    transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: testAccount.user, // generated ethereal user
            pass: testAccount.pass, // generated ethereal password
        },
    });

    console.log('Ethereal Email transporter ready');
    return transporter;
}

const sendEmail = async (to, subject, html) => {
    try {
        const t = await createTransporter();

        const info = await t.sendMail({
            from: '"Scaller Scheduler" <noreply@scaller.com>', // sender address
            to, // list of receivers
            subject, // Subject line
            html, // html body
        });

        console.log("Message sent: %s", info.messageId);
        console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
        return info;
    } catch (error) {
        console.error("Error sending email:", error);
    }
};

const sendBookingConfirmation = async (booking) => {
    const subject = `Confirmed: ${booking.event_title} between ${booking.booker_name} and ${booking.host_name}`;

    const startTime = new Date(booking.start_time).toLocaleString();
    const endTime = new Date(booking.end_time).toLocaleString();

    const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Booking Confirmed</h2>
      <p>Hi ${booking.booker_name},</p>
      <p>Your meeting <strong>${booking.event_title}</strong> with <strong>${booking.host_name}</strong> has been scheduled.</p>
      
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 10px;"><strong>When:</strong><br> ${startTime} - ${endTime}</p>
        <p style="margin: 0;"><strong>Where:</strong><br> Cal Video (Link will be provided)</p>
      </div>

      <p>Need to make changes? <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/bookings/${booking.uid}/cancel">Cancel</a> or <a href="#">Reschedule</a>.</p>
    </div>
  `;

    // Send to booker
    await sendEmail(booking.booker_email, subject, html);

    // Send to host (assuming host email is available or stored)
    if (booking.host_email) {
        await sendEmail(booking.host_email, `New Booking: ${subject}`, html.replace(`Hi ${booking.booker_name}`, `Hi ${booking.host_name}`));
    }
};

const sendBookingCancellation = async (booking) => {
    const subject = `Cancelled: ${booking.event_title} between ${booking.booker_name} and ${booking.host_name}`;

    const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Booking Cancelled</h2>
      <p>The following meeting has been cancelled:</p>
      
      <div style="background: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Event:</strong> ${booking.event_title}</p>
        <p style="margin: 10px 0 0;"><strong>With:</strong> ${booking.booker_name}</p>
      </div>
    </div>
  `;

    await sendEmail(booking.booker_email, subject, html);
    if (booking.host_email) {
        await sendEmail(booking.host_email, subject, html);
    }
};

module.exports = {
    sendBookingConfirmation,
    sendBookingCancellation
};
