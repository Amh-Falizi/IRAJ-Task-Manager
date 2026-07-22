# 👥 Team & User Administration

This section covers managing organizational teams, setting domain access, using the Admin User Management panel, and navigating the User Profile & Settings Carousel.

---

## 1. Team Management (`/teams`)

Teams allow you to group users by department or function (e.g. *Frontend Engineering*, *DevOps*, *QA Testing*).

### Managing Teams:
1. Navigate to **Teams** (`/teams`).
2. Click **"Create Team"**.
3. Enter team name, description, and assign team lead.
4. Add team members and set domain restrictions (e.g. `@company.com`).

---

## 2. Admin User Management (`/users-admin`)

*(Accessible only to users with the **Admin** role)*

The Admin User Management panel provides full control over user directory records:

### Admin Actions:
- **Role Assignment**: Elevate members to **Manager** or **Admin**, or downgrade roles.
- **Account Activation / Deactivation**: Temporarily disable user access without deleting their historical activity or assigned tasks.
- **Password Reset**: Trigger account recovery or issue temporary passwords.
- **User Search & Filter**: Filter users by role, department, or active status.

---

## 3. User Profile & Settings Carousel (`/profile`)

The User Profile page features an interactive **Grabbable Settings Carousel** for easy navigation across settings sections:

### Carousel Sections:
1. **General Settings**: Update display name, job title, avatar, and notification preferences.
2. **Recent Activity**: Audit log of your recent task movements, comments, and created branches.
3. **Security Log**: Review active login sessions, OAuth providers linked, and security events.
4. **Skills & Expertise**: Add and showcase technical skills tags (e.g. `TypeScript`, `React`, `Docker`, `PostgreSQL`).
5. **Integrations**: Link GitHub/GitLab personal accounts and view active API keys.
6. **Backup & Restore** *(Admin Only)*: In-app database export and import utility.

### Operating the Settings Carousel:
- **Mouse Drag / Swipe**: Click and hold on the tab bar to drag and scroll through section tabs smoothly.
- **Chevron Navigation**: Use the left/right arrow buttons to slide between adjacent sections.
- **Slide Indicator**: Shows current section position (e.g., *Slide 1 / 6*).
