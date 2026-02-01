-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'in_progress', 'paused', 'completed', 'overdue', 'cancelled', 'reassigned', 'qc_approved', 'data_entered');

-- CreateEnum
CREATE TYPE "PerformanceRating" AS ENUM ('Excellent', 'Good', 'Average', 'Poor', 'Lazy');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('frequency_missed', 'performance', 'general', 'chat_message', 'chat_mention');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('daily', 'weekly', 'monthly');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('dm', 'group', 'client', 'team', 'assignment', 'task', 'support');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('text', 'image', 'file', 'system');

-- CreateEnum
CREATE TYPE "PackageType" AS ENUM ('INDIVIDUAL', 'BUSINESS', 'CUSTOM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "passwordHash" TEXT,
    "roleId" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "category" TEXT,
    "address" TEXT,
    "biography" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "clientId" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "qcId" TEXT,
    "user_field_01" TEXT,
    "user_field_02" TEXT,
    "user_field_03" INTEGER,
    "user_field_04" INTEGER,
    "user_field_05" BOOLEAN,
    "user_field_06" JSONB,
    "user_field_07" JSONB,
    "user_field_08" JSONB,
    "user_field_09" JSONB,
    "user_field_10" JSONB,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "impersonatedBy" TEXT,
    "userId" TEXT NOT NULL,
    "session_field_01" TEXT,
    "session_field_02" TEXT,
    "session_field_03" INTEGER,
    "session_field_04" INTEGER,
    "session_field_05" BOOLEAN,
    "session_field_06" JSONB,
    "session_field_07" JSONB,
    "session_field_08" JSONB,
    "session_field_09" JSONB,
    "session_field_10" JSONB,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "account_field_01" TEXT,
    "account_field_02" TEXT,
    "account_field_03" INTEGER,
    "account_field_04" INTEGER,
    "account_field_05" BOOLEAN,
    "account_field_06" JSONB,
    "account_field_07" JSONB,
    "account_field_08" JSONB,
    "account_field_09" JSONB,
    "account_field_10" JSONB,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "verification_field_01" TEXT,
    "verification_field_02" TEXT,
    "verification_field_03" INTEGER,
    "verification_field_04" INTEGER,
    "verification_field_05" BOOLEAN,
    "verification_field_06" JSONB,
    "verification_field_07" JSONB,
    "verification_field_08" JSONB,
    "verification_field_09" JSONB,
    "verification_field_10" JSONB,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "role_field_01" TEXT,
    "role_field_02" TEXT,
    "role_field_03" INTEGER,
    "role_field_04" INTEGER,
    "role_field_05" BOOLEAN,
    "role_field_06" JSONB,
    "role_field_07" JSONB,
    "role_field_08" JSONB,
    "role_field_09" JSONB,
    "role_field_10" JSONB,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permission_field_01" TEXT,
    "permission_field_02" TEXT,
    "permission_field_03" INTEGER,
    "permission_field_04" INTEGER,
    "permission_field_05" BOOLEAN,
    "permission_field_06" JSONB,
    "permission_field_07" JSONB,
    "permission_field_08" JSONB,
    "permission_field_09" JSONB,
    "permission_field_10" JSONB,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "rolepermission_field_01" TEXT,
    "rolepermission_field_02" TEXT,
    "rolepermission_field_03" INTEGER,
    "rolepermission_field_04" INTEGER,
    "rolepermission_field_05" BOOLEAN,
    "rolepermission_field_06" JSONB,
    "rolepermission_field_07" JSONB,
    "rolepermission_field_08" JSONB,
    "rolepermission_field_09" JSONB,
    "rolepermission_field_10" JSONB,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "team_field_01" TEXT,
    "team_field_02" TEXT,
    "team_field_03" INTEGER,
    "team_field_04" INTEGER,
    "team_field_05" BOOLEAN,
    "team_field_06" JSONB,
    "team_field_07" JSONB,
    "team_field_08" JSONB,
    "team_field_09" JSONB,
    "team_field_10" JSONB,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Package" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "totalMonths" INTEGER,
    "type" "PackageType" NOT NULL DEFAULT 'INDIVIDUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "package_field_01" TEXT,
    "package_field_02" TEXT,
    "package_field_03" INTEGER,
    "package_field_04" INTEGER,
    "package_field_05" BOOLEAN,
    "package_field_06" JSONB,
    "package_field_07" JSONB,
    "package_field_08" JSONB,
    "package_field_09" JSONB,
    "package_field_10" JSONB,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "taskcategory_field_01" TEXT,
    "taskcategory_field_02" TEXT,
    "taskcategory_field_03" INTEGER,
    "taskcategory_field_04" INTEGER,
    "taskcategory_field_05" BOOLEAN,
    "taskcategory_field_06" JSONB,
    "taskcategory_field_07" JSONB,
    "taskcategory_field_08" JSONB,
    "taskcategory_field_09" JSONB,
    "taskcategory_field_10" JSONB,

    CONSTRAINT "TaskCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthdate" TIMESTAMP(3),
    "gender" TEXT,
    "company" TEXT,
    "designation" TEXT,
    "location" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "password" TEXT,
    "recoveryEmail" TEXT,
    "websites" JSONB,
    "biography" TEXT,
    "imageDrivelink" TEXT,
    "articleTopics" JSONB,
    "companywebsite" TEXT,
    "companyaddress" TEXT,
    "avatar" TEXT,
    "progress" INTEGER DEFAULT 0,
    "status" TEXT,
    "packageId" TEXT,
    "startDate" TIMESTAMP(3),
    "renewalDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "renewalCount" INTEGER DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "otherField" JSONB,
    "socialMedia" JSONB NOT NULL,
    "amId" TEXT,
    "client_field_01" TEXT,
    "client_field_02" TEXT,
    "client_field_03" INTEGER,
    "client_field_04" INTEGER,
    "client_field_05" BOOLEAN,
    "client_field_06" JSONB,
    "client_field_07" JSONB,
    "client_field_08" JSONB,
    "client_field_09" JSONB,
    "client_field_10" JSONB,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientTeamMember" (
    "clientId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "role" TEXT,
    "teamId" TEXT,
    "assignedDate" TIMESTAMP(3),
    "assignedTasks" INTEGER DEFAULT 0,
    "completedTasks" INTEGER DEFAULT 0,
    "lateTasks" INTEGER DEFAULT 0,
    "clientteammember_field_01" TEXT,
    "clientteammember_field_02" TEXT,
    "clientteammember_field_03" INTEGER,
    "clientteammember_field_04" INTEGER,
    "clientteammember_field_05" BOOLEAN,
    "clientteammember_field_06" JSONB,
    "clientteammember_field_07" JSONB,
    "clientteammember_field_08" JSONB,
    "clientteammember_field_09" JSONB,
    "clientteammember_field_10" JSONB,

    CONSTRAINT "ClientTeamMember_pkey" PRIMARY KEY ("clientId","agentId")
);

-- CreateTable
CREATE TABLE "AssetType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "categoryName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "packageId" TEXT,
    "status" TEXT,
    "template_field_01" TEXT,
    "template_field_02" TEXT,
    "template_field_03" INTEGER,
    "template_field_04" INTEGER,
    "template_field_05" BOOLEAN,
    "template_field_06" JSONB,
    "template_field_07" JSONB,
    "template_field_08" JSONB,
    "template_field_09" JSONB,
    "template_field_10" JSONB,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateSiteAsset" (
    "id" SERIAL NOT NULL,
    "templateId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "description" TEXT,
    "isRequired" BOOLEAN NOT NULL,
    "defaultPostingFrequency" INTEGER,
    "defaultIdealDurationMinutes" INTEGER,
    "templatesiteasset_field_01" TEXT,
    "templatesiteasset_field_02" TEXT,
    "templatesiteasset_field_03" INTEGER,
    "templatesiteasset_field_04" INTEGER,
    "templatesiteasset_field_05" BOOLEAN,
    "templatesiteasset_field_06" JSONB,
    "templatesiteasset_field_07" JSONB,
    "templatesiteasset_field_08" JSONB,
    "templatesiteasset_field_09" JSONB,
    "templatesiteasset_field_10" JSONB,

    CONSTRAINT "TemplateSiteAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateTeamMember" (
    "templateId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "role" TEXT,
    "teamId" TEXT,
    "assignedDate" TIMESTAMP(3),
    "templateteammember_field_01" TEXT,
    "templateteammember_field_02" TEXT,
    "templateteammember_field_03" INTEGER,
    "templateteammember_field_04" INTEGER,
    "templateteammember_field_05" BOOLEAN,
    "templateteammember_field_06" JSONB,
    "templateteammember_field_07" JSONB,
    "templateteammember_field_08" JSONB,
    "templateteammember_field_09" JSONB,
    "templateteammember_field_10" JSONB,

    CONSTRAINT "TemplateTeamMember_pkey" PRIMARY KEY ("templateId","agentId")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "clientId" TEXT,
    "assignedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT,
    "assignment_field_01" TEXT,
    "assignment_field_02" TEXT,
    "assignment_field_03" INTEGER,
    "assignment_field_04" INTEGER,
    "assignment_field_05" BOOLEAN,
    "assignment_field_06" JSONB,
    "assignment_field_07" JSONB,
    "assignment_field_08" JSONB,
    "assignment_field_09" JSONB,
    "assignment_field_10" JSONB,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentSiteAssetSetting" (
    "id" SERIAL NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "templateSiteAssetId" INTEGER NOT NULL,
    "requiredFrequency" INTEGER,
    "period" "PeriodType" NOT NULL DEFAULT 'monthly',
    "idealDurationMinutes" INTEGER,
    "assignmentsiteassetsetting_field_01" TEXT,
    "assignmentsiteassetsetting_field_02" TEXT,
    "assignmentsiteassetsetting_field_03" INTEGER,
    "assignmentsiteassetsetting_field_04" INTEGER,
    "assignmentsiteassetsetting_field_05" BOOLEAN,
    "assignmentsiteassetsetting_field_06" JSONB,
    "assignmentsiteassetsetting_field_07" JSONB,
    "assignmentsiteassetsetting_field_08" JSONB,
    "assignmentsiteassetsetting_field_09" JSONB,
    "assignmentsiteassetsetting_field_10" JSONB,

    CONSTRAINT "AssignmentSiteAssetSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT,
    "clientId" TEXT,
    "templateSiteAssetId" INTEGER,
    "categoryId" TEXT,
    "assignedToId" TEXT,
    "name" TEXT NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'medium',
    "dueDate" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "idealDurationMinutes" INTEGER,
    "actualDurationMinutes" INTEGER,
    "performanceRating" "PerformanceRating",
    "completionLink" TEXT,
    "taskCompletionJson" JSONB,
    "email" TEXT,
    "password" TEXT,
    "username" TEXT,
    "notes" TEXT,
    "reassignNotes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "qcReview" JSONB,
    "qcTotalScore" INTEGER DEFAULT 0,
    "pauseReasons" JSONB DEFAULT '[]',
    "socialCommunications" JSONB DEFAULT '[]',
    "dataEntryReport" JSONB,
    "task_field_01" TEXT,
    "task_field_02" TEXT,
    "task_field_03" INTEGER,
    "task_field_04" INTEGER,
    "task_field_05" BOOLEAN,
    "task_field_06" JSONB,
    "task_field_07" JSONB,
    "task_field_08" JSONB,
    "task_field_09" JSONB,
    "task_field_10" JSONB,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "authorId" TEXT,
    "text" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment_field_01" TEXT,
    "comment_field_02" TEXT,
    "comment_field_03" INTEGER,
    "comment_field_04" INTEGER,
    "comment_field_05" BOOLEAN,
    "comment_field_06" JSONB,
    "comment_field_07" JSONB,
    "comment_field_08" JSONB,
    "comment_field_09" JSONB,
    "comment_field_10" JSONB,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "authorId" TEXT,
    "text" TEXT NOT NULL,
    "severity" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "report_field_01" TEXT,
    "report_field_02" TEXT,
    "report_field_03" INTEGER,
    "report_field_04" INTEGER,
    "report_field_05" BOOLEAN,
    "report_field_06" JSONB,
    "report_field_07" JSONB,
    "report_field_08" JSONB,
    "report_field_09" JSONB,
    "report_field_10" JSONB,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,
    "activitylog_field_01" TEXT,
    "activitylog_field_02" TEXT,
    "activitylog_field_03" INTEGER,
    "activitylog_field_04" INTEGER,
    "activitylog_field_05" BOOLEAN,
    "activitylog_field_06" JSONB,
    "activitylog_field_07" JSONB,
    "activitylog_field_08" JSONB,
    "activitylog_field_09" JSONB,
    "activitylog_field_10" JSONB,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT,
    "type" "NotificationType" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "notification_field_01" TEXT,
    "notification_field_02" TEXT,
    "notification_field_03" INTEGER,
    "notification_field_04" INTEGER,
    "notification_field_05" BOOLEAN,
    "notification_field_06" JSONB,
    "notification_field_07" JSONB,
    "notification_field_08" JSONB,
    "notification_field_09" JSONB,
    "notification_field_10" JSONB,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "type" "ConversationType" NOT NULL DEFAULT 'dm',
    "title" TEXT,
    "createdById" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "conversation_field_01" TEXT,
    "conversation_field_02" TEXT,
    "conversation_field_03" INTEGER,
    "conversation_field_04" INTEGER,
    "conversation_field_05" BOOLEAN,
    "conversation_field_06" JSONB,
    "conversation_field_07" JSONB,
    "conversation_field_08" JSONB,
    "conversation_field_09" JSONB,
    "conversation_field_10" JSONB,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT,
    "lastReadAt" TIMESTAMP(3),
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationparticipant_field_01" TEXT,
    "conversationparticipant_field_02" TEXT,
    "conversationparticipant_field_03" INTEGER,
    "conversationparticipant_field_04" INTEGER,
    "conversationparticipant_field_05" BOOLEAN,
    "conversationparticipant_field_06" JSONB,
    "conversationparticipant_field_07" JSONB,
    "conversationparticipant_field_08" JSONB,
    "conversationparticipant_field_09" JSONB,
    "conversationparticipant_field_10" JSONB,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("conversationId","userId")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT,
    "type" "MessageType" NOT NULL DEFAULT 'text',
    "content" TEXT,
    "attachments" JSONB,
    "replyToId" TEXT,
    "mentions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "chatmessage_field_01" TEXT,
    "chatmessage_field_02" TEXT,
    "chatmessage_field_03" INTEGER,
    "chatmessage_field_04" INTEGER,
    "chatmessage_field_05" BOOLEAN,
    "chatmessage_field_06" JSONB,
    "chatmessage_field_07" JSONB,
    "chatmessage_field_08" JSONB,
    "chatmessage_field_09" JSONB,
    "chatmessage_field_10" JSONB,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageReceipt" (
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "messagereceipt_field_01" TEXT,
    "messagereceipt_field_02" TEXT,
    "messagereceipt_field_03" INTEGER,
    "messagereceipt_field_04" INTEGER,
    "messagereceipt_field_05" BOOLEAN,
    "messagereceipt_field_06" JSONB,
    "messagereceipt_field_07" JSONB,
    "messagereceipt_field_08" JSONB,
    "messagereceipt_field_09" JSONB,
    "messagereceipt_field_10" JSONB,

    CONSTRAINT "MessageReceipt_pkey" PRIMARY KEY ("messageId","userId")
);

-- CreateTable
CREATE TABLE "MessageReaction" (
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "messagereaction_field_01" TEXT,
    "messagereaction_field_02" TEXT,
    "messagereaction_field_03" INTEGER,
    "messagereaction_field_04" INTEGER,
    "messagereaction_field_05" BOOLEAN,
    "messagereaction_field_06" JSONB,
    "messagereaction_field_07" JSONB,
    "messagereaction_field_08" JSONB,
    "messagereaction_field_09" JSONB,
    "messagereaction_field_10" JSONB,

    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("messageId","userId","emoji")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_impersonatedBy_idx" ON "Session"("impersonatedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_key" ON "Permission"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Package_name_key" ON "Package"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TaskCategory_name_key" ON "TaskCategory"("name");

-- CreateIndex
CREATE INDEX "Client_amId_idx" ON "Client"("amId");

-- CreateIndex
CREATE UNIQUE INDEX "AssetType_slug_key" ON "AssetType"("slug");

-- CreateIndex
CREATE INDEX "TemplateSiteAsset_type_idx" ON "TemplateSiteAsset"("type");

-- CreateIndex
CREATE INDEX "Conversation_type_idx" ON "Conversation"("type");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageReceipt_userId_messageId_idx" ON "MessageReceipt"("userId", "messageId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_qcId_fkey" FOREIGN KEY ("qcId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_amId_fkey" FOREIGN KEY ("amId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientTeamMember" ADD CONSTRAINT "ClientTeamMember_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientTeamMember" ADD CONSTRAINT "ClientTeamMember_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientTeamMember" ADD CONSTRAINT "ClientTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateSiteAsset" ADD CONSTRAINT "TemplateSiteAsset_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateSiteAsset" ADD CONSTRAINT "TemplateSiteAsset_type_fkey" FOREIGN KEY ("type") REFERENCES "AssetType"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateTeamMember" ADD CONSTRAINT "TemplateTeamMember_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateTeamMember" ADD CONSTRAINT "TemplateTeamMember_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateTeamMember" ADD CONSTRAINT "TemplateTeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSiteAssetSetting" ADD CONSTRAINT "AssignmentSiteAssetSetting_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSiteAssetSetting" ADD CONSTRAINT "AssignmentSiteAssetSetting_templateSiteAssetId_fkey" FOREIGN KEY ("templateSiteAssetId") REFERENCES "TemplateSiteAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_templateSiteAssetId_fkey" FOREIGN KEY ("templateSiteAssetId") REFERENCES "TemplateSiteAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TaskCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReceipt" ADD CONSTRAINT "MessageReceipt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReceipt" ADD CONSTRAINT "MessageReceipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

