import { describe, expect, it } from "bun:test";
import { readWorkspaceSource } from "./admin-settings-test-sources";

const adminUsersSettingsSourcePath = "apps/web/src/features/admin/AdminUsersSettings.tsx";

describe("admin users settings state", () => {
  it("groups related dialog and expansion state with useReducer", async () => {
    const source = await readWorkspaceSource(adminUsersSettingsSourcePath);

    expect(source).toContain("useReducer");
    expect(source).toContain("const [uiState, dispatchUiState] = useReducer(");
    expect(source).toContain("dispatchUiState({ isCreateOpen: true })");
    expect(source).toContain("dispatchUiState({ expandedUserId })");
    expect(source).not.toContain("const [isCreateOpen, setIsCreateOpen] = useState(false)");
    expect(source).not.toContain(
      "const [expandedUserId, setExpandedUserId] = useState<string | null>(null)",
    );
    expect(source).not.toContain("const [passwordDialogUser, setPasswordDialogUser]");
    expect(source).not.toContain("const [permissionsDialogUser, setPermissionsDialogUser]");
    expect(source).not.toContain("const [deleteDialogUser, setDeleteDialogUser]");
  });
});
